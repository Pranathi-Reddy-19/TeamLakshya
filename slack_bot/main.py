# slack_bot/main.py
import os
import json
import asyncio
from typing import Dict, Any, List
from datetime import datetime

import requests
from fastapi import FastAPI, Request, HTTPException, BackgroundTasks
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError
from slack_sdk.signature import SignatureVerifier
from pydantic import BaseModel

# --- Configuration ---
SLACK_BOT_TOKEN = os.environ.get("SLACK_BOT_TOKEN")
SLACK_SIGNING_SECRET = os.environ.get("SLACK_SIGNING_SECRET")
BACKEND_API_URL = os.environ.get("BACKEND_API_URL", "http://backend:8000/api/v1")

if not all([SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET]):
    raise RuntimeError("Missing SLACK_BOT_TOKEN or SLACK_SIGNING_SECRET in environment")

# --- Clients ---
app = FastAPI(title="Slack Events Bot")
slack_client = WebClient(token=SLACK_BOT_TOKEN)
verifier = SignatureVerifier(SLACK_SIGNING_SECRET)

# --- In-memory Caches ---
user_cache: Dict[str, Dict[str, str]] = {}
channel_cache: Dict[str, str] = {}


# --- Pydantic Models ---
class SlackChallenge(BaseModel):
    token: str
    challenge: str
    type: str


class SlackEventWrapper(BaseModel):
    token: str
    team_id: str
    api_app_id: str
    event: Dict[str, Any]
    type: str
    event_id: str
    event_time: int
    authorizations: List[Dict[str, Any]] = []


# --- Helper Functions ---
def get_user_info(user_id: str) -> Dict[str, str]:
    """Fetch and cache user info."""
    if user_id in user_cache:
        return user_cache[user_id]

    try:
        result = slack_client.users_info(user=user_id)
        user = result["user"]
        profile = user.get("profile", {})
        info = {
            "name": user.get("real_name") or user.get("name", "Unknown User"),
            "email": profile.get("email", "no-email@example.com"),
        }
        user_cache[user_id] = info
        return info
    except SlackApiError as e:
        print(f"[ERROR] Failed to fetch user {user_id}: {e}")
        return {"name": "Unknown User", "email": "no-email@example.com"}


def get_channel_name(channel_id: str) -> str:
    """Fetch and cache channel name."""
    if channel_id in channel_cache:
        return channel_cache[channel_id]

    try:
        result = slack_client.conversations_info(channel=channel_id)
        name = result["channel"].get("name", "unknown_channel")
        channel_cache[channel_id] = name
        return name
    except SlackApiError as e:
        error_code = e.response.get("error")
        if error_code in ["method_not_supported_for_channel_type", "channel_not_found"]:
            channel_cache[channel_id] = "direct_message"
            return "direct_message"
        print(f"[ERROR] Failed to fetch channel {channel_id}: {e}")
        return "unknown_channel"


def format_canonical_event(event: Dict[str, Any]) -> Dict[str, Any]:
    """Convert Slack event to canonical format."""
    user_id = event.get("user")
    channel_id = event.get("channel")
    ts = event.get("ts", "0")
    timestamp = datetime.fromtimestamp(float(ts)).isoformat()

    user_info = get_user_info(user_id) if user_id else {"name": "unknown", "email": "unknown"}
    channel_name = get_channel_name(channel_id) if channel_id else "unknown"

    return {
        "id": event.get("client_msg_id") or f"slack-{channel_id}-{ts}",
        "source": "slack",
        "channel": channel_name,
        "channel_id": channel_id,
        "user_id": user_id,
        "user_name": user_info["name"],
        "user_email": user_info["email"],
        "text": event.get("text", ""),
        "timestamp": timestamp,
        "raw_data": event,
    }


# --- FIX 2: Use asyncio.to_thread to avoid blocking the event loop ---
async def send_to_backend(events: List[Dict[str, Any]]):
    """Send list of canonical events to backend."""
    url = f"{BACKEND_API_URL}/ingest/events/slack"
    
    # Define the blocking I/O function
    def blocking_post():
        return requests.post(url, json=events, timeout=10)
        
    try:
        # Run the blocking function in a separate thread
        response = await asyncio.to_thread(blocking_post)
        
        if response.status_code >= 400:
            print(f"[ERROR] Backend rejected events: {response.status_code} {response.text}")
        else:
            print(f"[SUCCESS] Sent {len(events)} event(s) to backend")
    except requests.exceptions.RequestException as e:
        print(f"[ERROR] Failed to send to backend: {e}")
    except Exception as e:
        print(f"[FATAL] Unexpected error in send_to_backend: {e}")


# --- Event Processing ---
async def process_slack_event(event_data: Dict[str, Any]):
    """Process a single Slack message event."""
    if event_data.get("subtype") or event_data.get("bot_id"):
        return  # Ignore edits, bot messages, etc.

    if event_data.get("type") != "message":
        return  # Only handle message events

    canonical = format_canonical_event(event_data)
    await send_to_backend([canonical])


# --- FastAPI Endpoints ---
@app.post("/slack/events")
async def slack_events(request: Request, background_tasks: BackgroundTasks):
    """
    Slack Events API endpoint.
    Handles:
    - URL verification (challenge)
    - Event callbacks (async processing)
    """
    raw_body = await request.body()
    headers = request.headers

    # Verify Slack signature
    if not verifier.is_valid_request(raw_body, headers):
        print("[SECURITY] Invalid Slack signature")
        raise HTTPException(status_code=403, detail="Invalid signature")

    try:
        payload = await request.json()
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    # Handle URL verification
    if payload.get("type") == "url_verification":
        challenge = payload.get("challenge")
        if not challenge:
            raise HTTPException(status_code=400, detail="Missing challenge")
        return {"challenge": challenge}

    # Handle event callback
    if payload.get("type") == "event_callback":
        event = payload.get("event", {})
        event_type = event.get("type")

        if event_type == "message":
            # Offload to background task to respond quickly to Slack
            background_tasks.add_task(process_slack_event, event)
            return {"status": "received"}

        return {"status": "ignored_non_message"}

    return {"status": "unhandled"}


# --- Health Check ---
@app.get("/health")
async def health():
    return {"status": "healthy", "service": "slack-bot"}


# --- Startup ---
@app.on_event("startup")
async def startup_event():
    print(f"Slack Bot started")
    print(f"Backend URL: {BACKEND_API_URL}/ingest/events/slack")
    print(f"User cache size: {len(user_cache)} | Channel cache size: {len(channel_cache)}")