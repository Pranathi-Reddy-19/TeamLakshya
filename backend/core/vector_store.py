# backend/core/vector_store.py
from pymilvus import MilvusClient, CollectionSchema, FieldSchema, DataType
from typing import List, Dict, Any, Optional
import traceback

# --- FIXED: Relative import from within 'core' package ---
from .db_connect import db_manager
# --- End of fix ---

from .embedding import embedding_service
from .models import CanonicalEvent
from ml.extractor import extractor_service


class VectorStore:
    """
    Handles all interactions with the Milvus vector database.
    Uses pymilvus 2.3.4+ MilvusClient API.
    Stores REDACTED text in 'text' field for search preview.
    """
    COLLECTION_NAME = "context_iq_memory"
    EMBEDDING_DIM = 384  # Must match your embedding model

    def __init__(self):
        """Initialize with Milvus client and ensure collection exists."""
        self.client = db_manager.get_milvus_client()
        self.embedding_service = embedding_service
        print("VectorStore initialized with Milvus client.")
        self.create_collection_if_not_exists()

    def get_schema(self) -> CollectionSchema:
        """Define the Milvus collection schema."""
        fields = [
            FieldSchema(name="id", dtype=DataType.VARCHAR, is_primary=True, max_length=512),
            FieldSchema(name="vector", dtype=DataType.FLOAT_VECTOR, dim=self.EMBEDDING_DIM),
            # Store REDACTED text for search preview
            FieldSchema(name="text", dtype=DataType.VARCHAR, max_length=65535),
            FieldSchema(name="source", dtype=DataType.VARCHAR, max_length=100),
            FieldSchema(name="channel", dtype=DataType.VARCHAR, max_length=256),
            FieldSchema(name="user_name", dtype=DataType.VARCHAR, max_length=256),
            FieldSchema(name="timestamp", dtype=DataType.INT64),
            FieldSchema(name="sentiment_label", dtype=DataType.VARCHAR, max_length=50),
            FieldSchema(name="sentiment_score", dtype=DataType.FLOAT),
        ]
        return CollectionSchema(
            fields=fields,
            description="Context IQ: Embeddings + metadata for organizational memory",
            enable_dynamic_field=True  # Allows extra fields
        )

    def create_collection_if_not_exists(self):
        """Create collection with schema and index if not exists."""
        try:
            if self.client.has_collection(self.COLLECTION_NAME):
                print(f"Collection '{self.COLLECTION_NAME}' already exists.")
                return

            print(f"Creating collection '{self.COLLECTION_NAME}'...")
            schema = self.get_schema()
            self.client.create_collection(
                collection_name=self.COLLECTION_NAME,
                schema=schema
            )
            print(f"Collection '{self.COLLECTION_NAME}' created.")
            self.create_index()

        except Exception as e:
            print(f"Error creating collection: {e}")
            traceback.print_exc()
            raise

    def create_index(self):
        """Create IVF_FLAT index on vector field."""
        try:
            print(f"Creating index on '{self.COLLECTION_NAME}.vector'...")
            index_params = self.client.prepare_index_params()
            index_params.add_index(
                field_name="vector",
                index_type="IVF_FLAT",
                metric_type="L2",
                params={"nlist": 128}
            )
            self.client.create_index(
                collection_name=self.COLLECTION_NAME,
                index_params=index_params
            )
            print("Index created.")
        except Exception as e:
            print(f"Error creating index: {e}")
            traceback.print_exc()

    def load_collection(self):
        """Load collection into memory (optional with MilvusClient)."""
        try:
            # MilvusClient auto-loads; this is safe to call
            self.client.load_collection(self.COLLECTION_NAME)
            print(f"Collection '{self.COLLECTION_NAME}' loaded.")
        except Exception as e:
            print(f"Warning: Could not load collection (may be auto-loaded): {e}")

    def insert_events(self, events: List[CanonicalEvent], extractions: List[Dict[str, Any]]) -> int:
        """
        Embed and insert events into Milvus.
        Uses redacted text from extractions.
        """
        if not events or not extractions or len(events) != len(extractions):
            print("Warning: Mismatched or empty events/extractions in insert_events.")
            return 0

        print(f"Inserting {len(events)} events into Milvus...")

        texts_to_embed = [e.text for e in events]
        try:
            embeddings = self.embedding_service.embed_documents(texts_to_embed)
        except Exception as e:
            print(f"Error generating embeddings: {e}")
            return 0

        data = []
        for i, event in enumerate(events):
            extraction = extractions[i]
            sentiment = extraction.get('sentiment', {'label': 'neutral', 'score': 0.0})
            data.append({
                "id": str(event.id),
                "vector": embeddings[i],
                "text": str(extraction.get("redacted_text", event.text))[:65535],
                "source": str(event.source)[:100],
                "channel": str(event.channel)[:256],
                "user_name": str(event.user_name)[:256],
                "timestamp": int(event.timestamp.timestamp()),
                "sentiment_label": str(sentiment.get('label', 'neutral'))[:50],
                "sentiment_score": float(sentiment.get('score', 0.0))
            })

        try:
            self.load_collection()
            res = self.client.insert(
                collection_name=self.COLLECTION_NAME,
                data=data
            )
            count = res.get('insert_count', len(data)) if isinstance(res, dict) else len(data)
            print(f"Milvus insert successful: {count} vectors.")
            return count
        except Exception as e:
            print(f"Error during Milvus insert: {e}")
            traceback.print_exc()
            return 0

    def search(
        self,
        query_embedding: List[float],
        top_k: int = 5,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Search Milvus for similar vectors.
        Returns metadata including REDACTED text.
        """
        if len(query_embedding) != self.EMBEDDING_DIM:
            print(f"Error: Query embedding dim {len(query_embedding)} != {self.EMBEDDING_DIM}")
            return []

        # Build filter expression
        filter_expr = ""
        if filters:
            parts = []
            for k, v in filters.items():
                if isinstance(v, str):
                    parts.append(f'{k} == "{v}"')
                elif isinstance(v, (int, float, bool)):
                    parts.append(f'{k} == {v}')
            filter_expr = " and ".join(parts) if parts else ""

        try:
            self.load_collection()

            # ✅ FIX: Move 'limit' inside search_params and use 'search_params' argument
            # The 'param' argument is deprecated in newer pymilvus versions
            search_params = {
                "metric_type": "L2", 
                "params": {"nprobe": 10},
                "limit": top_k  # ✅ FIXED: limit is now inside search_params
            }
            
            output_fields = [
                "text", "source", "channel", "user_name",
                "timestamp", "sentiment_label", "sentiment_score"
            ]

            print(f"Searching Milvus (top_k={top_k}, filter='{filter_expr or 'None'})...")
            
            # ✅ FIX: Use 'search_params' instead of deprecated 'param'
            results = self.client.search(
                collection_name=self.COLLECTION_NAME,
                data=[query_embedding],
                anns_field="vector",
                search_params=search_params,  # ✅ FIXED: Changed from 'param' to 'search_params'
                filter=filter_expr or None,
                output_fields=output_fields
            )

            hits = results[0] if results else []
            processed = []

            for hit in hits:
                entity = hit.get('entity', {}) if isinstance(hit, dict) else {}
                processed.append({
                    "event_id": hit.get('id'),
                    "score": hit.get('distance', float('inf')),
                    "text": entity.get('text', ''),
                    "source": entity.get('source', 'unknown'),
                    "channel": entity.get('channel', 'unknown'),
                    "user_name": entity.get('user_name', 'unknown'),
                    "timestamp": entity.get('timestamp'),
                    "sentiment_label": entity.get('sentiment_label', 'neutral'),
                    "sentiment_score": entity.get('sentiment_score', 0.0)
                })

            print(f"Milvus search returned {len(processed)} results.")
            return processed

        except Exception as e:
            print(f"Error during Milvus search: {e}")
            traceback.print_exc()
            return []

    def clear_collection(self):
        """Drop and recreate the collection."""
        try:
            if self.client.has_collection(self.COLLECTION_NAME):
                self.client.drop_collection(self.COLLECTION_NAME)
                print(f"Collection '{self.COLLECTION_NAME}' dropped.")
            self.create_collection_if_not_exists()
        except Exception as e:
            print(f"Error clearing collection: {e}")
            traceback.print_exc()

    def get_collection_stats(self) -> Dict[str, Any]:
        """Get collection stats."""
        try:
            if not self.client.has_collection(self.COLLECTION_NAME):
                return {"exists": False}

            schema = self.client.describe_collection(self.COLLECTION_NAME)
            count_result = self.client.query(
                collection_name=self.COLLECTION_NAME,
                filter="",
                output_fields=["count(*)"]
            )
            row_count = count_result[0].get("count(*)", 0) if count_result else 0

            return {
                "collection_name": self.COLLECTION_NAME,
                "row_count": row_count,
                "schema": schema
            }
        except Exception as e:
            return {"error": str(e)}


# --- Singleton ---
_vector_store_instance: Optional[VectorStore] = None

def get_vector_store() -> VectorStore:
    global _vector_store_instance
    if _vector_store_instance is None:
        _vector_store_instance = VectorStore()
    return _vector_store_instance