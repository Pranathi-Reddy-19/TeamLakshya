# backend/core/rag_service.py
import asyncio
import traceback
from typing import List, Dict, Any, Optional
from datetime import datetime

# --- FIXED: Relative imports from within the 'core' package ---
from .embedding import embedding_service
from .vector_store import VectorStore
from .graph_store import GraphStore
from .llm_service import llm_service
from .audit_service import log_action, AuditCategory, AuditLevel
# --- End of import fixes ---

# External ML service
from ml.extractor import extractor_service


class RAGService:
    """
    Retrieval-Augmented Generation service.
    Orchestrates vector search, graph enrichment, PII redaction, and LLM generation.
    Supports role-based access (admin sees raw, others see redacted).
    """

    def __init__(self):
        self.vector_store = VectorStore()
        self.graph_store = GraphStore()
        self.llm_service = llm_service
        self.embedding_service = embedding_service
        print("RAGService initialized.")

    async def search_context(
        self,
        query: str,
        top_k: int = 3,
        filters: Optional[Dict[str, Any]] = None,
        include_graph_context: bool = False,
        user_role: str = "analyst"
    ) -> List[Dict[str, Any]]:
        """
        Search Milvus for similar events, enrich with Neo4j, apply PII redaction.
        Returns role-appropriate text and optional graph context.
        """
        if not query or not query.strip():
            print("Warning: Empty query in RAGService.search_context")
            return []

        print(f"RAG: Searching context for: '{query}' (top_k={top_k}, role={user_role})")

        try:
            # Step 1: Embed query (FIXED: Wrapped in asyncio.to_thread to prevent blocking)
            query_embedding_list = await asyncio.to_thread(
                self.embedding_service.get_embeddings, 
                [query]
            )
            if not query_embedding_list:
                raise ValueError("Failed to generate query embedding.")
            query_embedding = query_embedding_list[0]
            
            print(f"  Generated embedding (dim: {len(query_embedding)})")

            # Step 2: Search Milvus (wrap synchronous call in thread)
            similar_events = await asyncio.to_thread(
                self.vector_store.search,
                query_embedding=query_embedding,
                top_k=top_k,
                filters=filters
            )

            if not similar_events:
                print("  No similar events found in Milvus")
                return []

            print(f"  Found {len(similar_events)} candidates in Milvus")
            event_ids = [e["event_id"] for e in similar_events]

            # Step 3: Enrich from Neo4j with role-based text
            graph_data_map = await self._query_graph_context(
                event_ids=event_ids,
                user_role=user_role,
                include_graph_context=include_graph_context
            )

            # Step 4: Combine and apply PII
            results = []
            for event in similar_events:
                event_id = event["event_id"]
                neo4j_data = graph_data_map.get(event_id, {})

                # Use redacted text by default
                display_text = neo4j_data.get("text", event.get("text", ""))

                # Admin override: log access to raw PII
                if user_role == "admin" and "raw_text" in neo4j_data:
                    display_text = neo4j_data["raw_text"]
                    asyncio.create_task(
                        log_action(
                            user_id="system_admin",  # TODO: Pass real user
                            action="VIEW_RAW_PII",
                            category=AuditCategory.DATA_ACCESS,
                            level=AuditLevel.SENSITIVE,
                            details={"event_id": event_id, "query": query}
                        )
                    )

                result = {
                    "event_id": event_id,
                    "score": event.get("score", 0.0),
                    "text": display_text,
                    "source": neo4j_data.get("source"),
                    "channel": neo4j_data.get("channel_id"),
                    "user_name": neo4j_data.get("user_name"),
                    "timestamp": neo4j_data.get("timestamp"),
                    "sentiment_label": neo4j_data.get("sentiment_label", "neutral"),
                    "sentiment_score": neo4j_data.get("sentiment_score", 0.0),
                }

                if include_graph_context and "graph_context" in neo4j_data:
                    result["graph_context"] = neo4j_data["graph_context"]

                results.append(result)

            print(f"  Returning {len(results)} enriched results")
            return results

        except Exception as e:
            print(f"Error in RAG.search_context: {e}")
            traceback.print_exc()
            return []

    async def _query_graph_context(
        self,
        event_ids: List[str],
        user_role: str,
        include_graph_context: bool
    ) -> Dict[str, Dict[str, Any]]:
        """
        Query Neo4j for event text (redacted/raw) and optional relationships.
        """
        text_field = "evt.raw_text" if user_role == "admin" else "evt.redacted_text"

        if include_graph_context:
            query = f"""
                UNWIND $event_ids AS eid
                MATCH (evt:Event {{event_id: eid}})
                WITH evt, {text_field} AS display_text
                OPTIONAL MATCH (evt)-[:LEAD_TO]->(d:Decision)
                OPTIONAL MATCH (evt)-[:CREATES]->(t:Task)
                OPTIONAL MATCH (evt)-[:MENTIONS]->(e:Entity)
                RETURN 
                    evt.event_id AS event_id,
                    evt.raw_text AS raw_text,
                    display_text AS text,
                    evt.source AS source,
                    evt.channel_id AS channel_id,
                    evt.user_name AS user_name,
                    evt.timestamp AS timestamp,
                    evt.sentiment_label AS sentiment_label,
                    evt.sentiment_score AS sentiment_score,
                    COLLECT(DISTINCT {{id: d.decision_id, text: d.text}}) AS decisions,
                    COLLECT(DISTINCT {{id: t.task_id, text: t.text, status: t.status}}) AS tasks,
                    COLLECT(DISTINCT {{name: e.name}}) AS entities
            """
        else:
            query = f"""
                UNWIND $event_ids AS eid
                MATCH (evt:Event {{event_id: eid}})
                RETURN 
                    evt.event_id AS event_id,
                    evt.raw_text AS raw_text,
                    {text_field} AS text,
                    evt.source AS source,
                    evt.channel_id AS channel_id,
                    evt.user_name AS user_name,
                    evt.timestamp AS timestamp,
                    evt.sentiment_label AS sentiment_label,
                    evt.sentiment_score AS sentiment_score
            """

        context_map = {}
        try:
            # Use the async graph store method
            results = await self.graph_store.run_cypher_query(query, {"event_ids": event_ids})
            
            for record in results:
                eid = record["event_id"]
                context_map[eid] = {
                    "text": record["text"] or "",
                    "raw_text": record.get("raw_text"),
                    "source": record.get("source"),
                    "channel_id": record.get("channel_id"),
                    "user_name": record.get("user_name"),
                    "timestamp": record.get("timestamp"),
                    "sentiment_label": record.get("sentiment_label"),
                    "sentiment_score": record.get("sentiment_score"),
                }
                if include_graph_context:
                    context_map[eid]["graph_context"] = {
                        "related_decisions": [
                            d for d in record["decisions"] if d.get("text")
                        ],
                        "related_tasks": [
                            t for t in record["tasks"] if t.get("text")
                        ],
                        "related_entities": [
                            e for e in record["entities"] if e.get("name")
                        ],
                    }
        except Exception as e:
            print(f"Error in Neo4j query: {e}")
            raise

        return context_map

    async def generate_answer(
        self,
        query: str,
        context: List[Dict[str, Any]],
        chat_history: List[Dict[str, str]] = None
    ) -> str:
        """Generate answer using LLM with context and history."""
        chat_history = chat_history or []
        print("RAG: Generating answer via LLM...")
        try:
            answer = await self.llm_service.generate_answer_async(
                query=query,
                context=context,
                chat_history=chat_history
            )
            print("Answer generated.")
            return answer
        except Exception as e:
            print(f"LLM generation failed: {e}")
            return "I encountered an error while generating the response."

    async def query(
        self,
        query: str,
        top_k: int = 3,
        filters: Optional[Dict[str, Any]] = None,
        include_graph_context: bool = False,
        user_role: str = "analyst",
        chat_history: List[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Full RAG pipeline: search + generate."""
        # Now we can directly await since search_context is async
        context = await self.search_context(
            query=query,
            top_k=top_k,
            filters=filters,
            include_graph_context=include_graph_context,
            user_role=user_role
        )

        answer = await self.generate_answer(query, context, chat_history or [])

        return {
            "query": query,
            "answer": answer,
            "evidence": context,
            "total_evidence": len(context)
        }

    # Async convenience methods
    async def semantic_search(
        self,
        query: str,
        source_filter: Optional[str] = None,
        top_k: int = 5,
        user_role: str = "analyst"
    ) -> List[Dict[str, Any]]:
        filters = {"source": source_filter} if source_filter else None
        return await self.search_context(
            query=query,
            top_k=top_k,
            filters=filters,
            include_graph_context=False,
            user_role=user_role
        )

    async def get_sentiment_analysis(
        self,
        query: str,
        top_k: int = 10,
        user_role: str = "analyst"
    ) -> Dict[str, Any]:
        results = await self.search_context(query, top_k, user_role=user_role)
        if not results:
            return {"query": query, "total_results": 0, "sentiment_summary": {}}

        counts = {"positive": 0, "negative": 0, "neutral": 0}
        scores = []

        for r in results:
            label = r.get("sentiment_label", "neutral")
            score = r.get("sentiment_score", 0.0)
            if label in counts:
                counts[label] += 1
            scores.append(score)

        avg = sum(scores) / len(scores) if scores else 0.0

        return {
            "query": query,
            "total_results": len(results),
            "sentiment_summary": {
                "distribution": counts,
                "average_score": round(avg, 3),
                "min_score": min(scores) if scores else 0.0,
                "max_score": max(scores) if scores else 0.0,
            },
            "sample_results": results[:3]
        }


# --- Singleton Instance ---
rag_service = RAGService()