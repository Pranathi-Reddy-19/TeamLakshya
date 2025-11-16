# backend/core/graph_store.py
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta, timezone
import asyncio
import traceback
import re
import logging

# --- FIX: Use relative imports ---
from .db_connect import db_manager
from .models import CanonicalEvent, UserInDB, User
from .notification_service import notification_service
# --- End of fix ---

# Configure logging
logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)


class GraphStore:
    """
    Handles all interactions with Neo4j graph database.
    UPDATED: Now uses async Neo4j driver and triggers notifications on task assignment and status updates.
    ADDED: Performance analytics endpoint.
    ADDED: User authentication functions.
    ADDED: Risk analysis data retrieval.
    ADDED: Team dynamics analysis (knowledge silos, influencers, cross-team interactions).
    FIXED: Schema alignment - all properties and relationships now match between insert and query methods.
    """
    
    # Agreement keywords for detecting consensus
    AGREEMENT_KEYWORDS = [
        "agree", "agreed", "makes sense", "good point", "sounds good",
        "let's do that", "great idea", "i'm aligned", "support this", "approve",
        "endorsed", "concur", "exactly", "precisely", "absolutely"
    ]

    def __init__(self):
        # Driver will be fetched asynchronously
        log.info("GraphStore initialized.")

    async def create_constraints(self):
        """
        Create unique constraints on node IDs to prevent duplicates.
        ADDED: User username constraint for authentication.
        """
        log.info(" → Applying Neo4j constraints...")
        driver = await db_manager.get_neo4j_driver()
        
        constraints = [
            "CREATE CONSTRAINT IF NOT EXISTS FOR (u:User) REQUIRE u.user_id IS UNIQUE",
            "CREATE CONSTRAINT IF NOT EXISTS FOR (c:Channel) REQUIRE c.channel_id IS UNIQUE",
            "CREATE CONSTRAINT IF NOT EXISTS FOR (e:Event) REQUIRE e.event_id IS UNIQUE",
            "CREATE CONSTRAINT IF NOT EXISTS FOR (en:Entity) REQUIRE en.name IS UNIQUE",
            "CREATE CONSTRAINT IF NOT EXISTS FOR (d:Decision) REQUIRE d.decision_id IS UNIQUE",
            "CREATE CONSTRAINT IF NOT EXISTS FOR (t:Task) REQUIRE t.task_id IS UNIQUE",
            "CREATE CONSTRAINT IF NOT EXISTS FOR (u:User) REQUIRE u.username IS UNIQUE",
        ]
        
        try:
            async with driver.session() as session:
                for constraint in constraints:
                    await session.run(constraint)
            log.info(" ✓ Neo4j constraints applied.")
        except Exception as e:
            log.error(f"Error applying Neo4j constraints: {e}")
            traceback.print_exc()
            raise

    async def insert_events_graph(self, events: List[CanonicalEvent], extractions: List[Dict[str, Any]]):
        """
        Inserts a batch of events and their extracted data into Neo4j.
        FIXED: Now creates ALL properties and relationships that query methods expect.
        """
        if not events or not extractions or len(events) != len(extractions):
            log.warning("Events and extractions list mismatch or empty in GraphStore.")
            return

        log.info(f" → Inserting {len(events)} events into Neo4j graph...")
        driver = await db_manager.get_neo4j_driver()

        data_to_insert = []
        for i in range(len(events)):
            event = events[i]
            extraction = extractions[i]
            
            sentiment_info = extraction.get('sentiment', {'score': 0.0, 'label': 'neutral'})
            
            tasks_data = []
            for task in extraction.get('tasks', []):
                task_assignee = task.get("assignee")
                if not task_assignee:
                    task_assignee = event.user_id
                tasks_data.append({
                    "text": task.get("text", ""),
                    "assignee": task_assignee
                })
            
            # Extract entity information with types
            entities_data = []
            for entity in extraction.get('entities', []):
                entities_data.append({
                    "text": entity.get('text', ''),
                    "label": entity.get('label', 'MISC')
                })
            
            data_to_insert.append({
                "event_id": event.id,
                "raw_text": event.text,
                "text": event.text,  # ADDED: For compatibility
                "redacted_text": extraction.get("redacted_text", event.text),
                "source": event.source,
                "timestamp": event.timestamp.isoformat(),
                "user_id": event.user_id,
                "user_name": event.user_name or event.user_id,
                "username": event.user_name or event.user_id,  # ADDED: For User node
                "channel_id": event.channel or "unknown_channel",
                "entities": entities_data,
                "decisions": [d['text'] for d in extraction.get('decisions', [])],
                "tasks": tasks_data,
                "sentiment_label": sentiment_info.get('label', 'neutral'),
                "sentimentLabel": sentiment_info.get('label', 'neutral'),  # ADDED: Camel case version
                "sentiment_score": sentiment_info.get('score', 0.0),
                "sentimentScore": sentiment_info.get('score', 0.0)  # ADDED: Camel case version
            })

        query = """
        UNWIND $events AS e
        
        // Create User node with ALL properties
        MERGE (speaker:User {user_id: e.user_id}) 
        ON CREATE SET 
            speaker.name = e.user_name,
            speaker.username = e.username
        ON MATCH SET
            speaker.name = e.user_name,
            speaker.username = e.username
        
        // Create Channel node with ALL properties
        MERGE (c:Channel {channel_id: e.channel_id}) 
        ON CREATE SET 
            c.source = e.source,
            c.name = e.channel_id

        // Create Event node with ALL properties
        MERGE (evt:Event {event_id: e.event_id})
        ON CREATE SET 
            evt.raw_text = e.raw_text,
            evt.text = e.text,
            evt.redacted_text = e.redacted_text,
            evt.timestamp = datetime(e.timestamp),
            evt.source = e.source,
            evt.sentimentLabel = e.sentimentLabel,
            evt.sentimentScore = e.sentimentScore,
            evt.sentiment_label = e.sentiment_label,
            evt.sentiment_score = e.sentiment_score
        ON MATCH SET
            evt.raw_text = e.raw_text,
            evt.text = e.text,
            evt.redacted_text = e.redacted_text,
            evt.timestamp = datetime(e.timestamp),
            evt.source = e.source,
            evt.sentimentLabel = e.sentimentLabel,
            evt.sentimentScore = e.sentimentScore,
            evt.sentiment_label = e.sentiment_label,
            evt.sentiment_score = e.sentiment_score

        // Create SAID relationship
        MERGE (speaker)-[:SAID]->(evt)
        
        // Create IN_CHANNEL relationship
        MERGE (evt)-[:IN_CHANNEL]->(c)

        // Create Entity nodes and MENTIONS relationships
        FOREACH (entity IN e.entities |
            MERGE (en:Entity {name: entity.text})
            ON CREATE SET en.type = entity.label
            ON MATCH SET en.type = entity.label
            MERGE (evt)-[:MENTIONS]->(en)
        )

        // Create Decision nodes and LEAD_TO relationships
        FOREACH (idx IN range(0, size(e.decisions)) |
            MERGE (d:Decision {decision_id: e.event_id + '-decision-' + toString(idx)})
            ON CREATE SET 
                d.text = e.decisions[idx],
                d.summary = e.decisions[idx]
            ON MATCH SET
                d.text = e.decisions[idx],
                d.summary = e.decisions[idx]
            MERGE (evt)-[:LEAD_TO]->(d)
        )

        // Create Task nodes with ALL properties and CREATES relationships
        FOREACH (idx IN range(0, size(e.tasks)) |
            MERGE (t:Task {task_id: e.event_id + '-task-' + toString(idx)})
            ON CREATE SET 
                t.text = e.tasks[idx].text,
                t.summary = e.tasks[idx].text,
                t.status = 'open',
                t.assignee_id = e.tasks[idx].assignee,
                t.created_at = datetime(e.timestamp)
            ON MATCH SET
                t.text = e.tasks[idx].text,
                t.summary = e.tasks[idx].text,
                t.assignee_id = e.tasks[idx].assignee
            MERGE (evt)-[:CREATES]->(t)
        )
        
        RETURN count(*) as processed_events
        """

        try:
            async with driver.session() as session:
                result = await session.run(query, events=data_to_insert)
                summary = await result.consume()
                log.info(f" ✓ Neo4j insert successful. Nodes created: {summary.counters.nodes_created}, "
                      f"Rels created: {summary.counters.relationships_created}")
        except Exception as e:
            log.error(f"Error inserting data into Neo4j: {e}")
            traceback.print_exc()
            raise

    async def assign_tasks_to_users(self):
        """
        Second pass: Create ASSIGNED_TO relationships and send notifications.
        Only processes tasks without existing assignment.
        """
        log.info(" → Creating task assignments & sending notifications...")
        driver = await db_manager.get_neo4j_driver()
        
        query = """
        MATCH (t:Task {status: 'open'})
        WHERE t.assignee_id IS NOT NULL AND t.assignee_id <> ''
          AND NOT EXISTS((t)<-[:ASSIGNED_TO]-(:User))
        
        MERGE (u:User {user_id: t.assignee_id})
        ON CREATE SET u.name = t.assignee_id, u.username = t.assignee_id
        
        MERGE (u)-[r:ASSIGNED_TO]->(t)
        
        RETURN u.user_id AS assignee_id,
               t.text AS task_text,
               t.task_id AS task_id,
               t.status AS task_status
        """
        
        tasks_to_notify = []
        try:
            async with driver.session() as session:
                result = await session.run(query)
                records = [record async for record in result]
                
                if records:
                    for record in records:
                        tasks_to_notify.append(dict(record))
                    
                    log.info(f" ✓ Created {len(tasks_to_notify)} new task assignments.")
                else:
                    log.info(f" ✓ No new task assignments to create.")
        except Exception as e:
            log.error(f"Error creating task assignments: {e}")
            traceback.print_exc()
            return

        # --- Send notifications (fire-and-forget) ---
        if tasks_to_notify:
            log.info(f" → Sending {len(tasks_to_notify)} task notifications...")
            for task_info in tasks_to_notify:
                notification_data = {
                    "type": "NEW_TASK",
                    "payload": {
                        "task_id": task_info["task_id"],
                        "text": task_info["task_text"],
                        "status": task_info["task_status"]
                    }
                }
                asyncio.create_task(
                    notification_service.send_to_user(
                        task_info["assignee_id"],
                        notification_data
                    )
                )

    async def create_agreement_links(self, lookback_minutes: int = 60):
        """
        Scans recent events to find replies indicating agreement.
        """
        log.info(" → Creating agreement links in Neo4j...")
        driver = await db_manager.get_neo4j_driver()

        agreement_patterns = "|".join(f"(?i){re.escape(kw)}" for kw in self.AGREEMENT_KEYWORDS)

        query = """
            MATCH (agree_evt:Event)
            WHERE agree_evt.timestamp > datetime() - duration({minutes: $lookback_minutes})
              AND size(agree_evt.raw_text) < 150
              AND agree_evt.raw_text =~ $agreement_pattern

            MATCH (c:Channel)<-[:IN_CHANNEL]-(agree_evt)
            MATCH (c)<-[:IN_CHANNEL]-(orig_evt:Event)
            WHERE orig_evt.timestamp < agree_evt.timestamp
              AND agree_evt.timestamp - orig_evt.timestamp < duration({minutes: 5})

            MATCH (agree_user:User)-[:SAID]->(agree_evt)
            MATCH (orig_user:User)-[:SAID]->(orig_evt)
            WHERE agree_user <> orig_user

            MERGE (agree_user)-[r:AGREES_WITH]->(orig_user)
            ON CREATE SET r.count = 1, r.last_agreed = agree_evt.timestamp
            ON MATCH SET r.count = r.count + 1, r.last_agreed = agree_evt.timestamp

            RETURN count(r) AS links_created_or_updated
        """
        try:
            async with driver.session() as session:
                result = await session.run(
                    query,
                    lookback_minutes=lookback_minutes,
                    agreement_pattern=f".*({agreement_patterns}).*"
                )
                summary = await result.single()
                count = summary["links_created_or_updated"] if summary else 0
                log.info(f" ✓ Processed agreement links. Created/updated {count} relationships.")
        except Exception as e:
            log.error(f"Error creating agreement links: {e}")
            traceback.print_exc()

    async def get_open_tasks(self) -> List[Dict[str, Any]]:
        """
        Retrieves all tasks with status 'open' and their assignees.
        """
        log.info(" → Fetching open tasks from Neo4j...")
        driver = await db_manager.get_neo4j_driver()
        
        query = """
            MATCH (t:Task)
            WHERE t.status = 'open'
            
            OPTIONAL MATCH (u:User)-[:ASSIGNED_TO]->(t)
            OPTIONAL MATCH (evt:Event)-[:CREATES]->(t)
            
            RETURN 
                t.task_id AS id,
                COALESCE(t.text, 'Untitled Task') AS title,
                t.status AS status,
                COALESCE(u.user_id, t.assignee_id) AS assignee,
                t.created_at AS due_date
            ORDER BY t.created_at DESC
        """
        try:
            async with driver.session() as session:
                results = await session.run(query)
                tasks = []
                async for record in results:
                    task_data = dict(record)
                    # Convert Neo4j DateTime to ISO string
                    if task_data.get('due_date') and hasattr(task_data['due_date'], 'to_native'):
                        task_data['due_date'] = task_data['due_date'].to_native().isoformat()
                    tasks.append(task_data)
                
                log.info(f" ✓ Found {len(tasks)} open tasks.")
                return tasks
        except Exception as e:
            log.error(f"Error fetching open tasks: {e}")
            traceback.print_exc()
            return []

    async def update_task_status(self, task_id: str, new_status: str, user_id: str) -> Dict[str, Any]:
        """
        Updates the status of a specific task and notifies the assignee.
        """
        log.info(f" → Updating task {task_id} to status '{new_status}' by user {user_id}...")
        driver = await db_manager.get_neo4j_driver()
        
        query = """
            MATCH (t:Task {task_id: $task_id})
            SET t.status = $new_status, t.last_updated = datetime()
            WITH t
            OPTIONAL MATCH (u:User)-[:ASSIGNED_TO]->(t)
            RETURN
                t.task_id AS id,
                t.text AS title,
                t.status AS status,
                COALESCE(u.user_id, t.assignee_id) AS assignee
        """
        try:
            async with driver.session() as session:
                result = await session.run(query, task_id=task_id, new_status=new_status)
                record = await result.single()
                if not record:
                    raise Exception("Task not found")
                
                log.info(f" ✓ Task {task_id} updated.")
                
                # --- Send notification ---
                notification_data = {
                    "type": "TASK_UPDATE",
                    "payload": {
                        "task_id": record["id"],
                        "text": record["title"],
                        "status": record["status"],
                        "updated_by": user_id
                    }
                }
                if record["assignee"]:
                    asyncio.create_task(
                        notification_service.send_to_user(
                            record["assignee"],
                            notification_data
                        )
                    )
                
                return dict(record)
        except Exception as e:
            log.error(f"Error updating task {task_id}: {e}")
            traceback.print_exc()
            raise

    async def link_task_to_external_id(self, task_id: str, external_id: str, platform: str):
        """
        Links a task to an external system ID (e.g., Jira issue key).
        """
        log.info(f" → Linking task {task_id} to {platform} ID: {external_id}")
        driver = await db_manager.get_neo4j_driver()
        
        query = """
            MATCH (t:Task {task_id: $task_id})
            SET t.external_id = $external_id,
                t.external_platform = $platform,
                t.linked_at = datetime()
            RETURN t.task_id AS task_id
        """
        try:
            async with driver.session() as session:
                result = await session.run(query, task_id=task_id, external_id=external_id, platform=platform)
                record = await result.single()
                if not record:
                    raise Exception(f"Task {task_id} not found")
                log.info(f" ✓ Task {task_id} linked to {platform} ID: {external_id}")
        except Exception as e:
            log.error(f"Error linking task to external ID: {e}")
            traceback.print_exc()
            raise

    async def get_events_for_channel(self, channel_id: str, lookback_hours: int = 72) -> List[Dict[str, Any]]:
        """
        Retrieves all events for a specific channel within a lookback period.
        """
        log.info(f" → Fetching history for channel '{channel_id}' (last {lookback_hours}h)...")
        driver = await db_manager.get_neo4j_driver()
        after_time = datetime.now() - timedelta(hours=lookback_hours)
        
        query = """
            MATCH (c:Channel {channel_id: $channel_id})<-[:IN_CHANNEL]-(evt:Event)<-[:SAID]-(u:User)
            WHERE evt.timestamp > datetime($after_time_iso)
            RETURN 
                u.name AS user_name,
                evt.raw_text AS text,
                evt.timestamp AS timestamp
            ORDER BY evt.timestamp ASC
            LIMIT 200
        """
        try:
            async with driver.session() as session:
                results = await session.run(query, channel_id=channel_id, after_time_iso=after_time.isoformat())
                events = []
                async for record in results:
                    events.append({
                        "user_name": record["user_name"],
                        "text": record["text"],
                        "timestamp": record["timestamp"].to_native().isoformat()
                    })
                log.info(f" ✓ Found {len(events)} events for summarization.")
                return events
        except Exception as e:
            log.error(f"Error fetching channel history: {e}")
            traceback.print_exc()
            return []

    # --- Sentiment Methods ---
    
    async def get_sentiment_stats(self) -> Dict[str, Any]:
        driver = await db_manager.get_neo4j_driver()
        try:
            async with driver.session() as session:
                result = await session.run("""
                    MATCH (e:Event)
                    WHERE e.sentimentLabel IS NOT NULL
                    WITH count(e) AS total_messages,
                         sum(CASE WHEN e.sentimentLabel = 'positive' THEN 1 ELSE 0 END) AS positive_count,
                         sum(CASE WHEN e.sentimentLabel = 'neutral' THEN 1 ELSE 0 END) AS neutral_count,
                         sum(CASE WHEN e.sentimentLabel = 'negative' THEN 1 ELSE 0 END) AS negative_count
                    RETURN 
                        total_messages,
                        positive_count,
                        neutral_count,
                        negative_count,
                        CASE 
                            WHEN positive_count > neutral_count AND positive_count > negative_count THEN 'positive'
                            WHEN negative_count > neutral_count AND negative_count > positive_count THEN 'negative'
                            ELSE 'neutral'
                        END AS overall_sentiment,
                        CASE WHEN total_messages > 0 THEN toFloat(positive_count) / total_messages * 100 ELSE 0.0 END AS positive_pct,
                        CASE WHEN total_messages > 0 THEN toFloat(neutral_count) / total_messages * 100 ELSE 0.0 END AS neutral_pct,
                        CASE WHEN total_messages > 0 THEN toFloat(negative_count) / total_messages * 100 ELSE 0.0 END AS negative_pct
                """)
                record = await result.single()
                
                if record:
                    return {
                        "overall_sentiment": record["overall_sentiment"],
                        "positive_pct": float(record["positive_pct"]),
                        "neutral_pct": float(record["neutral_pct"]),
                        "negative_pct": float(record["negative_pct"]),
                        "total_messages": record["total_messages"]
                    }
                return {
                    "overall_sentiment": "neutral",
                    "positive_pct": 0.0,
                    "neutral_pct": 0.0,
                    "negative_pct": 0.0,
                    "total_messages": 0
                }
        except Exception as e:
            log.error(f"Error getting sentiment stats: {e}")
            traceback.print_exc()
            return {}

    async def get_user_sentiment_profile(self, user_id: str) -> Dict[str, Any]:
        driver = await db_manager.get_neo4j_driver()
        try:
            async with driver.session() as session:
                result = await session.run("""
                    MATCH (u:User {user_id: $user_id})-[:SAID]->(e:Event)
                    WHERE e.sentimentScore IS NOT NULL
                    RETURN 
                        count(e) as total_events,
                        avg(e.sentimentScore) as avg_sentiment,
                        collect(e.sentimentLabel) as sentiment_labels
                """, user_id=user_id)
                
                record = await result.single()
                if not record or record["total_events"] == 0:
                    return {
                        "user_id": user_id,
                        "total_events": 0,
                        "message": "No events found or user does not exist"
                    }
                
                labels = record["sentiment_labels"]
                label_counts = {
                    "positive": labels.count("positive"),
                    "negative": labels.count("negative"),
                    "neutral": labels.count("neutral")
                }
                
                return {
                    "user_id": user_id,
                    "total_events": record["total_events"],
                    "average_sentiment": float(record["avg_sentiment"] or 0.0),
                    "sentiment_distribution": label_counts
                }
        except Exception as e:
            log.error(f"Error getting user sentiment profile: {e}")
            traceback.print_exc()
            return {}

    async def get_channel_sentiment_trends(self, channel_id: str) -> Dict[str, Any]:
        driver = await db_manager.get_neo4j_driver()
        try:
            async with driver.session() as session:
                result = await session.run("""
                    MATCH (c:Channel {channel_id: $channel_id})<-[:IN_CHANNEL]-(e:Event)
                    WHERE e.sentimentScore IS NOT NULL
                    RETURN 
                        e.sentimentLabel as label,
                        count(*) as count,
                        avg(e.sentimentScore) as avg_score
                    ORDER BY count DESC
                """, channel_id=channel_id)
                
                trends = []
                async for record in result:
                    trends.append({
                        "sentiment": record["label"],
                        "count": record["count"],
                        "average_score": float(record["avg_score"] or 0.0)
                    })
                
                return {
                    "channel_id": channel_id,
                    "sentiment_trends": trends
                }
        except Exception as e:
            log.error(f"Error getting channel sentiment trends: {e}")
            traceback.print_exc()
            return {}

    async def get_sentiment_by_channel_summary(self) -> List[Dict[str, Any]]:
        driver = await db_manager.get_neo4j_driver()
        query = """
            MATCH (c:Channel)<-[:IN_CHANNEL]-(e:Event)
            WHERE e.sentimentScore IS NOT NULL
            RETURN c.channel_id AS channel,
                   count(e) AS total,
                   sum(CASE WHEN e.sentimentLabel = 'positive' THEN 1 ELSE 0 END) AS positive,
                   sum(CASE WHEN e.sentimentLabel = 'neutral' THEN 1 ELSE 0 END) AS neutral,
                   sum(CASE WHEN e.sentimentLabel = 'negative' THEN 1 ELSE 0 END) AS negative
            ORDER BY total DESC
            LIMIT 10
        """
        try:
            async with driver.session() as session:
                results = await session.run(query)
                return [dict(record) async for record in results]
        except Exception as e:
            log.error(f"Error fetching channel sentiment summary: {e}")
            traceback.print_exc()
            return []

    async def get_sentiment_timeline(self, days_limit: int = 30) -> List[Dict[str, Any]]:
        driver = await db_manager.get_neo4j_driver()
        query = """
            MATCH (e:Event)
            WHERE e.timestamp > datetime() - duration({days: $days_limit})
              AND e.sentimentScore IS NOT NULL
            WITH date(e.timestamp) AS day, e.sentimentScore AS score, e.sentimentLabel AS label
            WITH day,
                 toFloat(sum(CASE WHEN label = 'positive' THEN 1 ELSE 0 END)) AS positive,
                 toFloat(sum(CASE WHEN label = 'neutral' THEN 1 ELSE 0 END)) AS neutral,
                 toFloat(sum(CASE WHEN label = 'negative' THEN 1 ELSE 0 END)) AS negative,
                 toFloat(count(*)) AS total
            RETURN 
                toString(day) AS date,
                CASE WHEN total > 0 THEN positive / total ELSE 0.0 END AS positive,
                CASE WHEN total > 0 THEN neutral / total ELSE 0.0 END AS neutral,
                CASE WHEN total > 0 THEN negative / total ELSE 0.0 END AS negative
            ORDER BY day ASC
        """
        try:
            async with driver.session() as session:
                results = await session.run(query, days_limit=days_limit)
                timeline = []
                async for r in results:
                    timeline.append({
                        "date": r["date"],
                        "positive": float(r["positive"]),
                        "neutral": float(r["neutral"]),
                        "negative": float(r["negative"])
                    })
                return timeline
        except Exception as e:
            log.error(f"Error fetching sentiment timeline: {e}")
            traceback.print_exc()
            return []

    async def get_performance_analytics(self) -> Dict[str, Any]:
        """
        Runs a series of queries to get high-level team performance analytics.
        """
        log.info(" → Fetching performance analytics from Neo4j...")
        driver = await db_manager.get_neo4j_driver()
        
        analytics = {
            "top_active_channels": [],
            "top_contributors": [],
            "sentiment_over_time": [],
            "avg_response_time_seconds": None
        }
        try:
            async with driver.session() as session:
                
                # 1. Top Active Channels
                query_channels = """
                    MATCH (c:Channel)<-[:IN_CHANNEL]-(e:Event)
                    WHERE e.timestamp > datetime() - duration({days: 30})
                    RETURN c.channel_id AS label, count(e) AS value
                    ORDER BY value DESC LIMIT 5
                """
                results = await session.run(query_channels)
                analytics["top_active_channels"] = [dict(record) async for record in results]
                
                # 2. Top Contributors
                query_contributors = """
                    MATCH (u:User)-[:SAID]->(e:Event)
                    WHERE e.timestamp > datetime() - duration({days: 30})
                    RETURN u.name AS label, count(e) AS value
                    ORDER BY value DESC LIMIT 5
                """
                results = await session.run(query_contributors)
                analytics["top_contributors"] = [dict(record) async for record in results]
                
                # 3. Sentiment Over Time
                analytics["sentiment_over_time"] = await self.get_sentiment_timeline(days_limit=30)
                
                # 4. Average Response Time (Simplified)
                query_response_time = """
                    MATCH (c:Channel)<-[:IN_CHANNEL]-(e1:Event)
                    WHERE e1.timestamp > datetime() - duration({days: 30})
                      AND e1.raw_text CONTAINS '?'
                    MATCH (c)<-[:IN_CHANNEL]-(e2:Event)
                    WHERE e2.timestamp > e1.timestamp
                      AND e2.timestamp < e1.timestamp + duration({hours: 1})
                    MATCH (u1:User)-[:SAID]->(e1)
                    MATCH (u2:User)-[:SAID]->(e2)
                    WHERE u1.user_id <> u2.user_id
                    WITH duration.between(e1.timestamp, e2.timestamp).seconds AS responseInSeconds
                    WHERE responseInSeconds > 0
                    RETURN avg(responseInSeconds) AS avg_response_seconds
                """
                result = await session.run(query_response_time)
                record = await result.single()
                if record and record["avg_response_seconds"]:
                    analytics["avg_response_time_seconds"] = float(record["avg_response_seconds"])
                
                log.info(f" ✓ Performance analytics compiled.")
                return analytics
                
        except Exception as e:
            log.error(f"Error fetching performance analytics: {e}")
            traceback.print_exc()
            return analytics

    # --- NEW AUTH-RELATED FUNCTIONS ---
    
    async def get_user_by_username(self, username: str) -> Optional[UserInDB]:
        """
        Retrieves a user from Neo4j by their username.
        """
        driver = await db_manager.get_neo4j_driver()
        query = """
        MATCH (u:User {username: $username})
        RETURN u.username AS username, 
               u.email AS email, 
               u.full_name AS full_name, 
               u.role AS role, 
               u.hashed_password AS hashed_password
        LIMIT 1
        """
        try:
            async with driver.session() as session:
                result = await session.run(query, username=username)
                record = await result.single()
                
                if record:
                    user_data = dict(record)
                    return UserInDB(**user_data)
                return None
        except Exception as e:
            log.error(f"Error getting user by username: {e}")
            return None

    async def create_user(self, user: UserInDB) -> User:
        """
        Creates a new User node in Neo4j.
        """
        driver = await db_manager.get_neo4j_driver()
        query = """
        CREATE (u:User {
            username: $username,
            email: $email,
            full_name: $full_name,
            role: $role,
            hashed_password: $hashed_password,
            created_at: $created_at,
            user_id: $username
        })
        RETURN u.username AS username, 
               u.email AS email, 
               u.full_name AS full_name, 
               u.role AS role
        """
        try:
            async with driver.session() as session:
                result = await session.run(query, 
                                     username=user.username,
                                     email=user.email,
                                     full_name=user.full_name,
                                     role=user.role,
                                     hashed_password=user.hashed_password,
                                     created_at=datetime.now(timezone.utc).isoformat()
                                   )
                record = await result.single()
                return User(**dict(record))
        except Exception as e:
            log.error(f"Error creating user: {e}")
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="Username already exists")

    async def get_graph_context(self, event_id: str, depth: int = 1) -> Dict[str, Any]:
        """
        Gets the graph context around a specific event.
        """
        driver = await db_manager.get_neo4j_driver()
        query = f"""
        MATCH (e:Event {{event_id: $event_id}})-[r*1..{depth}]-(related)
        WITH e, COLLECT(DISTINCT related) AS neighbors
        RETURN e, neighbors
        """
        try:
            async with driver.session() as session:
                result = await session.run(query, event_id=event_id)
                record = await result.single()
                if record:
                    return {"center": dict(record["e"]), "neighbors": [dict(n) for n in record["neighbors"]]}
            return {}
        except Exception as e:
            log.error(f"Error getting graph context: {e}")
            return {}

    # --- NEW TEAM DYNAMICS METHODS ---
    async def get_knowledge_silos(self, threshold: float = 0.8) -> List[Dict[str, Any]]:
        """
        Finds topics (Tasks) where one person is doing most of the work.
        """
        driver = await db_manager.get_neo4j_driver()
        query = """
        MATCH (t:Task)<-[:ASSIGNED_TO]-(u:User)
        WITH t.text AS topic, u, count(*) AS assignment_count
        WITH topic, collect({user: u, count: assignment_count}) AS users, sum(assignment_count) AS total
        UNWIND users AS user_data
        WITH topic, user_data.user AS user, user_data.count AS user_count, total
        WITH topic, user, toFloat(user_count) / toFloat(total) AS percentage, user_count
        WHERE percentage >= $threshold AND total >= 3
        RETURN 
            topic,
            user.user_id AS user_id,
            user.name AS user_name,
            user_count AS event_count,
            percentage
        ORDER BY percentage DESC
        LIMIT 10
        """
        try:
            async with driver.session() as session:
                result = await session.run(query, threshold=threshold)
                return [dict(record) async for record in result]
        except Exception as e:
            log.error(f"Error in get_knowledge_silos: {e}")
            traceback.print_exc()
            return []

    async def get_key_influencers(self) -> List[Dict[str, Any]]:
        """
        Finds users who receive many agreements and replies.
        """
        driver = await db_manager.get_neo4j_driver()
        query = """
        MATCH (u:User)
        OPTIONAL MATCH (u)<-[:AGREES_WITH]-(other:User)
        WITH u, count(DISTINCT other) AS agreements_received
        OPTIONAL MATCH (u)-[:SAID]->(e:Event)
        WITH u, agreements_received, count(DISTINCT e) AS messages_sent
        WITH u, agreements_received, messages_sent,
             (agreements_received * 2) + messages_sent AS total_score
        WHERE total_score > 0
        RETURN
            u.user_id AS user_id,
            u.name AS user_name,
            agreements_received,
            messages_sent AS replies_received,
            total_score
        ORDER BY total_score DESC
        LIMIT 10
        """
        try:
            async with driver.session() as session:
                result = await session.run(query)
                return [dict(record) async for record in result]
        except Exception as e:
            log.error(f"Error in get_key_influencers: {e}")
            traceback.print_exc()
            return []

    async def get_team_interactions(self) -> List[Dict[str, Any]]:
        """
        Finds interactions between different channels (acting as teams).
        """
        driver = await db_manager.get_neo4j_driver()
        query = """
        MATCH (c1:Channel)<-[:IN_CHANNEL]-(e1:Event)<-[:SAID]-(u1:User)
        MATCH (c2:Channel)<-[:IN_CHANNEL]-(e2:Event)<-[:SAID]-(u2:User)
        WHERE c1.channel_id < c2.channel_id
          AND u1.user_id <> u2.user_id
          AND e1.timestamp > datetime() - duration({days: 30})
          AND e2.timestamp > datetime() - duration({days: 30})
          AND abs(duration.between(e1.timestamp, e2.timestamp).seconds) < 3600
        WITH c1.channel_id AS team_a, c2.channel_id AS team_b, count(*) AS interaction_count
        RETURN team_a, team_b, interaction_count
        ORDER BY interaction_count DESC
        LIMIT 10
        """
        try:
            async with driver.session() as session:
                result = await session.run(query)
                return [dict(record) async for record in result]
        except Exception as e:
            log.error(f"Error in get_team_interactions: {e}")
            traceback.print_exc()
            return []

    async def run_cypher_query(self, query: str, params: Dict = None) -> List[Dict[str, Any]]:
        """
        Run a custom Cypher query.
        """
        driver = await db_manager.get_neo4j_driver()
        results = []
        try:
            async with driver.session() as session:
                result = await session.run(query, params or {})
                async for record in result:
                    results.append(dict(record))
            return results
        except Exception as e:
            log.error(f"Error running custom Cypher query: {e}")
            raise

    async def clear_all_data(self):
        """
        Clear all data from Neo4j (use with caution!).
        """
        log.warning("Warning: Clearing all Neo4j data...")
        driver = await db_manager.get_neo4j_driver()
        try:
            async with driver.session() as session:
                await session.run("MATCH (n) DETACH DELETE n")
            log.info(" ✓ All data cleared")
        except Exception as e:
            log.error(f"Error clearing Neo4j data: {e}")
            traceback.print_exc()

    async def close(self):
        """Close the Neo4j driver connection (managed by db_manager)."""
        log.info("GraphStore close called (driver managed by db_manager).")

    # --- NEW: RISK ANALYSIS DATA RETRIEVAL ---
    async def get_risk_analysis_data(self, key_entities: List[str], entity_embeddings: List[List[float]], top_k: int = 3) -> Dict[str, Any]:
        """
        Queries the graph to find dependencies and sentiments
        related to a set of key entities.
        """
        driver = await db_manager.get_neo4j_driver()
       
        query = """
        WITH $key_entities AS entities
        MATCH (n)
        WHERE (n:Task OR n:Decision)
          AND any(entity IN entities WHERE toLower(n.text) CONTAINS toLower(entity) OR toLower(COALESCE(n.summary, '')) CONTAINS toLower(entity))
       
        OPTIONAL MATCH (d)-[r:DEPENDS_ON|:PART_OF|:CREATES]->(n)
        WITH n, collect(DISTINCT {
            node_type: labels(d)[0],
            node_id: COALESCE(d.task_id, d.decision_id, d.event_id, toString(id(d))),
            summary: COALESCE(d.text, d.summary, d.name, 'Unknown'),
            link_type: type(r)
        }) AS dependencies
       
        OPTIONAL MATCH (e:Event)-[:MENTIONS|:LEAD_TO|:CREATES]->(n)
        WHERE e.sentimentLabel <> 'neutral'
        WITH n, dependencies, e
        ORDER BY e.sentimentScore DESC, e.timestamp DESC
        LIMIT 10
       
        MATCH (u:User)-[:SAID]->(e)
        MATCH (c:Channel)<-[:IN_CHANNEL]-(e)
       
        WITH n, dependencies, collect(DISTINCT {
            user_name: u.name,
            text: e.raw_text,
            sentiment_label: e.sentimentLabel,
            sentiment_score: e.sentimentScore,
            channel: c.channel_id,
            timestamp: toString(e.timestamp)
        }) AS sentiments
        
        WITH collect(dependencies) AS all_deps_nested,
             collect(sentiments) AS all_sents_nested
            
        WITH [dep_list IN all_deps_nested | [item IN dep_list WHERE item.node_id IS NOT NULL]] AS all_deps,
             [sent_list IN all_sents_nested | [item IN sent_list WHERE item.user_name IS NOT NULL]] AS all_sents
             
        WITH reduce(acc = [], dep_list IN all_deps | acc + dep_list) AS flat_deps,
             reduce(acc = [], sent_list IN all_sents | acc + sent_list) AS flat_sents
            
        RETURN flat_deps AS dependencies, flat_sents AS sentiments
        """
       
        try:
            async with driver.session() as session:
                result = await session.run(query, key_entities=key_entities)
                data = await result.single()
                if data:
                    return {
                        "dependencies": data.get("dependencies", []),
                        "sentiments": data.get("sentiments", [])
                    }
                return {"dependencies": [], "sentiments": []}
        except Exception as e:
            log.error(f"Error in get_risk_analysis_data: {e}")
            traceback.print_exc()
            return {"dependencies": [], "sentiments": []}


# Global instance
graph_store = GraphStore()