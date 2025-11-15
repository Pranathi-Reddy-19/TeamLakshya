# backend/tasks.py
import asyncio
from datetime import datetime
from pathlib import Path
import shutil
import traceback
import logging
from typing import List, Dict, Any, Optional

from .celery_app import celery_app
from .core.audio_service import audio_service
from .core.multi_channel_ingestion import MultiChannelIngestionService, IngestionConfig, CanonicalEvent
from .core.vector_store import VectorStore
from .core.graph_store import GraphStore
from .core.notification_service import notification_service
from .core.jira_service import jira_service

# Configure logging
log = logging.getLogger(__name__)

# --- Singleton Instances for the Worker ---
# The worker needs its own instances of these services
try:
    ingestion_config = IngestionConfig()
    vector_store = VectorStore()
    graph_store = GraphStore()
    
    multi_ingestion_service = MultiChannelIngestionService(
        config=ingestion_config,
        vector_store=vector_store,
        graph_store=graph_store
    )
    print("Celery worker: Services initialized")
except Exception as e:
    print(f"Celery worker: Error initializing services: {e}")
    multi_ingestion_service = None

# --- Task 1: Audio Processing ---
@celery_app.task(name="backend.tasks.process_audio_task")
def process_audio_task(temp_file_path_str: str, original_filename: str):
    """
    Celery task to transcribe audio, create a CanonicalEvent, and ingest it.
    """
    if not multi_ingestion_service:
        return f"Error: Ingestion service not available."

    temp_file_path = Path(temp_file_path_str)
    
    try:
        print(f"Task process_audio_task: Starting for {original_filename}")
        result = audio_service.transcribe_audio_file(str(temp_file_path))
        text = result.get("text")
        
        if not text:
            raise Exception("Transcription failed or produced no text.")

        event = CanonicalEvent(
            id=f"audio-{original_filename}-{datetime.now().timestamp()}",
            source="zoom", # Or "local_audio"
            channel=f"meeting-{original_filename}",
            user_id="transcriber",
            user_name="Meeting AI",
            text=text,
            timestamp=datetime.now(),
            raw_data={"file": original_filename, "segments": len(result.get("segments", []))}
        )

        # Run the async ingestion processing
        # We must use asyncio.run() because this task is sync, but the service is async
        asyncio.run(
            multi_ingestion_service.process_and_store_events([event])
        )
        
        print(f"Task process_audio_task: Successfully processed {original_filename}")
        
        # Notify user (optional but good)
        asyncio.run(notification_service.broadcast({
            "type": "AUDIO_PROCESSED",
            "payload": {"filename": original_filename, "status": "success"}
        }))

        return f"Successfully processed {original_filename}"

    except Exception as e:
        print(f"Task process_audio_task: FAILED for {original_filename}: {e}")
        asyncio.run(notification_service.broadcast({
            "type": "AUDIO_PROCESSED",
            "payload": {"filename": original_filename, "status": "error", "error": str(e)}
        }))
        return f"Error processing {original_filename}: {e}"
    finally:
        # Clean up the temp file
        if temp_file_path.exists():
            try: 
                temp_file_path.unlink()
            except Exception as e:
                print(f"Failed to delete temp file {temp_file_path_str}: {e}")


# --- Task 2: Manual Ingestion ---
@celery_app.task(name="backend.tasks.run_ingestion_task")
def run_ingestion_task(source_name: str, lookback_hours: int = 72):
    """
    Celery task to run a manual ingestion job for a specific source.
    """
    if not multi_ingestion_service:
        return f"Error: Ingestion service not available."
    
    try:
        print(f"Task run_ingestion_task: Starting for {source_name}")
        
        # Update config if needed (we'll pass it for simplicity)
        multi_ingestion_service.config.lookback_hours = lookback_hours

        # Run the async ingestion
        stats = asyncio.run(
            multi_ingestion_service.run_ingestion_for_source(source_name)
        )
        
        print(f"Task run_ingestion_task: Completed for {source_name}. Events: {stats.get('total_events')}")
        
        # Notify user
        asyncio.run(notification_service.broadcast({
            "type": "INGESTION_COMPLETE",
            "payload": stats
        }))
        
        return stats
        
    except Exception as e:
        print(f"Task run_ingestion_task: FAILED for {source_name}: {e}")
        stats = {
            "source": source_name,
            "status": "error",
            "error": str(e),
            "message": f"Ingestion failed: {e}",
            "total_events": 0,
            "vectors_inserted": 0,
            "duration_seconds": 0
        }
        asyncio.run(notification_service.broadcast({
            "type": "INGESTION_COMPLETE",
            "payload": stats
        }))
        return stats

# --- Task 3: Generic Webhook Processing (THIS WAS MISSING) ---
@celery_app.task(name="backend.tasks.process_webhook_task")
def process_webhook_task(source_name: str, payload: Dict[str, Any]):
    """
    Celery task to process an incoming webhook.
    It identifies the source and dispatches to the correct handler.
    """
    if not multi_ingestion_service:
        log.error(f"Task process_webhook_task: Ingestion service not available.")
        return "Error: Ingestion service not available."

    log.info(f"Processing webhook for: {source_name}")
    
    try:
        events_to_ingest = []
        
        # --- Dispatch based on source ---
        if source_name == 'jira':
            events_to_ingest = _handle_jira_webhook(payload)
        
        elif source_name == 'notion':
            events_to_ingest = _handle_notion_webhook(payload)
            
        # ... (add other handlers as needed) ...
        
        else:
            log.warning(f"No handler found for webhook source: {source_name}")
            return f"No handler for {source_name}"
            
        # --- Ingest any extracted events ---
        if events_to_ingest:
            log.info(f"Ingesting {len(events_to_ingest)} events from {source_name} webhook")
            asyncio.run(
                multi_ingestion_service.process_and_store_events(events_to_ingest)
            )
            return f"Successfully processed {len(events_to_ingest)} events from {source_name}"
        else:
            log.info(f"No actionable events found in {source_name} webhook.")
            return f"No actionable events from {source_name}"

    except Exception as e:
        log.error(f"Task process_webhook_task: FAILED for {source_name}: {e}")
        traceback.print_exc()
        return f"Error processing {source_name} webhook: {e}"

# --- Helper Functions for Webhook Parsing ---
# (These live in tasks.py for simplicity)

def _handle_jira_webhook(payload: Dict[str, Any]) -> List[CanonicalEvent]:
    """
    Parses a Jira webhook payload and converts it into CanonicalEvents.
    This is highly specific to Jira's format.
    """
    webhook_event = payload.get("webhookEvent")
    issue = payload.get("issue", {})
    user = payload.get("user", {})
    comment = payload.get("comment", {})
    
    event_id = payload.get("timestamp") or datetime.now().timestamp()
    
    # Example: A new comment was added
    if webhook_event == "comment_created":
        text = f"Jira Comment on {issue.get('key', 'UNK')}: {comment.get('body', '')}"
        return [CanonicalEvent(
            id=f"jira-comment-{comment.get('id', event_id)}",
            source="jira",
            channel=issue.get('fields', {}).get('project', {}).get('key', 'JIRA'),
            user_id=comment.get('author', {}).get('name', 'jira_user'),
            user_name=comment.get('author', {}).get('displayName', 'Jira User'),
            text=text,
            timestamp=datetime.fromisoformat(comment.get('created', '').replace('Z', '+00:00')),
            raw_data=payload
        )]
        
    # Example: An issue was updated
    if webhook_event == "jira:issue_updated":
        changelog = payload.get("changelog", {})
        changed_item = changelog.get('items', [{}])[0]
        
        text = (
            f"Jira Issue {issue.get('key', 'UNK')} was updated by {user.get('displayName', 'Jira User')}. "
            f"Field '{changed_item.get('field')}' "
            f"changed from '{changed_item.get('fromString', 'N/A')}' "
            f"to '{changed_item.get('toString', 'N/A')}'."
        )
        
        return [CanonicalEvent(
            id=f"jira-update-{issue.get('id', event_id)}-{changelog.get('id', 'x')}",
            source="jira",
            channel=issue.get('fields', {}).get('project', {}).get('key', 'JIRA'),
            user_id=user.get('name', 'jira_user'),
            user_name=user.get('displayName', 'Jira User'),
            text=text,
            timestamp=datetime.now(), # Jira update webhooks don't have a great timestamp
            raw_data=payload
        )]

    return []


def _handle_notion_webhook(payload: Dict[str, Any]) -> List[CanonicalEvent]:
    """
    Parses a Notion webhook payload.
    (This is a placeholder, as Notion's webhooks are complex)
    """
    log.info("Processing Notion webhook... (logic not yet implemented)")
    # A real implementation would query the Notion API
    # using the 'page_id' from the payload to get the actual content
    return []