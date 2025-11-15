"""
Multi-Channel Data Ingestion Service
Supports: Slack, Discord, Microsoft Teams, Email (Gmail/Outlook), Google Docs, Notion, Local Files (PDF, DOCX), Jira
"""

import asyncio
import json
import os
import os.path
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Literal
from dataclasses import dataclass, asdict, field
from abc import ABC, abstractmethod
import traceback
import hashlib
from pathlib import Path

# --- FIX: Use relative imports for sibling modules ---
from .models import CanonicalEvent
from .db_connect import db_manager
from .vector_store import VectorStore
from .graph_store import GraphStore
from .embedding import embedding_service
# --- End of fix ---

# --- FIX: Import the singleton 'extractor_service' instance ---
from ml.extractor import extractor_service
# --- End of fix ---

# --- Third-party integrations (install via pip) ---
try:
    import discord
    DISCORD_AVAILABLE = True
except ImportError:
    DISCORD_AVAILABLE = False
    print("Warning: Discord library not available. Install: pip install discord.py")

try:
    from slack_sdk.web.async_client import AsyncWebClient
    from slack_sdk.errors import SlackApiError
    SLACK_AVAILABLE = True
except ImportError:
    SLACK_AVAILABLE = False
    print("Warning: Slack SDK not available. Install: pip install slack-sdk")

try:
    import msal
    import httpx
    TEAMS_AVAILABLE = True
except ImportError:
    TEAMS_AVAILABLE = False
    print("Warning: Microsoft Teams libraries not available. Install: pip install msal httpx")

try:
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build
    from google.auth.transport.requests import Request
    from google_auth_oauthlib.flow import InstalledAppFlow
    GOOGLE_AVAILABLE = True
except ImportError:
    GOOGLE_AVAILABLE = False
    print("Warning: Google API libraries not available. Install: pip install google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client")

try:
    from notion_client import AsyncClient as NotionAsyncClient
    NOTION_AVAILABLE = True
except ImportError:
    NOTION_AVAILABLE = False
    print("Warning: Notion client not available. Install: pip install notion-client")

try:
    import pypdf
    PYPDF_AVAILABLE = True
except ImportError:
    PYPDF_AVAILABLE = False
    print("Warning: PyPDF not available. Install: pip install pypdf")

try:
    import docx
    DOCX_AVAILABLE = True
except ImportError:
    DOCX_AVAILABLE = False
    print("Warning: python-docx not available. Install: pip install python-docx")

# --- FIX: Use relative import for sibling module ---
from .jira_service import jira_service, JIRAError
# --- End of fix ---


# Helper functions for default list values
def _get_slack_channels_from_env() -> List[str]:
    """Get Slack channels from environment variable"""
    channels = os.getenv("SLACK_CHANNELS", "").split(",")
    return [ch.strip() for ch in channels if ch.strip()]


def _get_discord_guilds_from_env() -> List[str]:
    """Get Discord guilds from environment variable"""
    guilds = os.getenv("DISCORD_GUILDS", "").split(",")
    return [g.strip() for g in guilds if g.strip()]


def _get_gmail_labels_from_env() -> List[str]:
    """Get Gmail labels from environment variable"""
    labels = os.getenv("GMAIL_LABELS", "INBOX").split(",")
    return [l.strip() for l in labels if l.strip()]


def _get_gdocs_folder_ids_from_env() -> List[str]:
    """Get Google Docs folder IDs from environment variable"""
    folders = os.getenv("GDOCS_FOLDER_IDS", "").split(",")
    return [f.strip() for f in folders if f.strip()]


def _get_notion_database_ids_from_env() -> List[str]:
    """Get Notion database IDs from environment variable"""
    dbs = os.getenv("NOTION_DATABASE_IDS", "").split(",")
    return [db.strip() for db in dbs if db.strip()]


def _get_jira_project_keys_from_env() -> List[str]:
    """Get Jira project keys from environment variable"""
    keys = os.getenv("JIRA_PROJECT_KEYS", "").split(",")
    return [k.strip() for k in keys if k.strip()]


@dataclass
class IngestionConfig:
    """
    Configuration for multi-channel ingestion
    
    IMPORTANT: All list fields use field(default_factory=...) to avoid
    mutable default arguments bug in Python dataclasses.
    """
    # Slack
    slack_token: Optional[str] = None
    slack_channels: List[str] = field(default_factory=_get_slack_channels_from_env)
    
    # Discord
    discord_token: Optional[str] = None
    discord_guilds: List[str] = field(default_factory=_get_discord_guilds_from_env)
    
    # Microsoft Teams
    teams_tenant_id: Optional[str] = None
    teams_client_id: Optional[str] = None
    teams_client_secret: Optional[str] = None
    
    # Google Services
    google_credentials_path: Optional[str] = None
    gmail_labels: List[str] = field(default_factory=_get_gmail_labels_from_env)
    gdocs_folder_ids: List[str] = field(default_factory=_get_gdocs_folder_ids_from_env)
    
    # This list is correct and matches your Google Cloud setup
    google_scopes: List[str] = field(default_factory=lambda: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/documents.readonly',
        'https://www.googleapis.com/auth/drive.metadata.readonly'
    ])
    
    # Notion
    notion_token: Optional[str] = None
    notion_database_ids: List[str] = field(default_factory=_get_notion_database_ids_from_env)
    
    # Local Files
    local_upload_dir: str = "data/uploads" # Use a relative path
    
    # Jira
    jira_project_keys: List[str] = field(default_factory=_get_jira_project_keys_from_env)
    
    # General settings
    batch_size: int = 100
    lookback_hours: int = 24
    use_sentiment: bool = True
    use_pii_redaction: bool = True
    
    def __post_init__(self):
        """Initialize fields from environment variables after dataclass creation"""
        # Override None values with environment variables
        if self.slack_token is None:
            self.slack_token = os.getenv("SLACK_BOT_TOKEN")
        
        if self.discord_token is None:
            self.discord_token = os.getenv("DISCORD_BOT_TOKEN")
        
        if self.teams_tenant_id is None:
            self.teams_tenant_id = os.getenv("TEAMS_TENANT_ID")
        if self.teams_client_id is None:
            self.teams_client_id = os.getenv("TEAMS_CLIENT_ID")
        if self.teams_client_secret is None:
            self.teams_client_secret = os.getenv("TEAMS_CLIENT_SECRET")
        
        # --- FIX: Use correct relative path for local execution ---
        if self.google_credentials_path is None:
            self.google_credentials_path = os.getenv("GOOGLE_CREDENTIALS_PATH", "backend/credentials.json")
        # --- END OF FIX ---
        
        if self.notion_token is None:
            self.notion_token = os.getenv("NOTION_TOKEN")
        
        if self.local_upload_dir == "data/uploads":
            self.local_upload_dir = os.getenv("LOCAL_UPLOAD_DIR", "data/uploads")

    def get_google_creds(self):
        """
        Handles Google OAuth2 flow.
        If token.json exists, it loads it.
        If not, it triggers the console-based auth flow.
        """
        if not GOOGLE_AVAILABLE:
            print("Warning: Google API libraries not available")
            return None
            
        creds = None
        
        # --- FIX: Use relative paths from env or default for local execution ---
        token_path = os.getenv("GOOGLE_TOKEN_PATH", "backend/token.json")
        creds_path = self.google_credentials_path
        # --- END OF FIX ---
        
        # Check if token.json exists
        if os.path.exists(token_path):
            print("Found existing Google token.json...")
            try:
                creds = Credentials.from_authorized_user_file(token_path, self.google_scopes)
            except Exception as e:
                print(f"Error loading token.json: {e}")
                creds = None
        
        # If no (valid) creds, let the user log in
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                print("Refreshing expired Google credentials...")
                try:
                    creds.refresh(Request())
                except Exception as e:
                    print(f"Error refreshing credentials: {e}")
                    creds = None
            
            if not creds:
                print("No valid Google credentials found. Starting auth flow...")
                if not os.path.exists(creds_path):
                    print(f"ERROR: credentials.json not found at {creds_path}")
                    print("Please ensure credentials.json is in your /backend folder.")
                    return None
                
                # This line tells the oauthlib library to allow HTTP redirects
                # from localhost, fixing the (insecure_transport) error.
                if os.getenv("OS_OAUTHLIB_INSECURE_TRANSPORT") == "1":
                    os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"
                
                try:
                    # Initialize Flow
                    flow = InstalledAppFlow.from_client_secrets_file(
                        creds_path, self.google_scopes
                    )
                    # Force the redirect_uri to match your Desktop App credentials
                    flow.redirect_uri = "http://localhost"

                    # 1. Generate the Auth URL
                    auth_url, _ = flow.authorization_url(prompt='consent')

                    print("\n" + "="*60)
                    print("MANUAL AUTHORIZATION STEP")
                    print("="*60)
                    print("1. Copy this URL and open it in your browser:")
                    print(f"\n{auth_url}\n")
                    print("-" * 60)
                    print("2. Log in and click 'Allow'.")
                    print("3. You will be redirected to a 'This site can't be reached' page.")
                    print("4. COPY THE ENTIRE URL from your browser address bar (it starts with http://localhost...)")
                    print("5. Paste it below.")
                    print("="*60)

                    # 2. Get the redirected URL from the user
                    # We use input() so the container waits for you
                    code_url = input("Paste the full redirect URL here: ").strip()

                    # 3. Fetch the token using the URL
                    # This extracts the 'code' parameter automatically
                    flow.fetch_token(authorization_response=code_url)
                    creds = flow.credentials

                except Exception as e:
                    print(f"\n❌ Error during OAuth flow: {e}")
                    traceback.print_exc()
                    return None
                    
            
            # Save the credentials for the next run
            try:
                # --- FIX: Ensure the directory exists before writing ---
                os.makedirs(os.path.dirname(token_path), exist_ok=True)
                # --- END OF FIX ---
                with open(token_path, "w") as token_file:
                    token_file.write(creds.to_json())
                print(f"✅ Google credentials saved to {token_path}")
            except Exception as e:
                print(f"Error saving token.json: {e}")
        
        print("Google credentials loaded successfully.")
        return creds


class DataConnector(ABC):
    """Abstract base class for data connectors"""
    
    def __init__(self, config: IngestionConfig):
        self.config = config
        
    @abstractmethod
    async def fetch_data(self) -> List[CanonicalEvent]:
        """Fetch data from the source and convert to canonical events"""
        pass
    
    @abstractmethod
    def get_source_name(self) -> str:
        """Return the name of the data source"""
        pass

    def is_configured(self) -> bool:
        """Check if the connector has the necessary config to run"""
        return True


# === SLACK CONNECTOR ===
class SlackConnector(DataConnector):
    def __init__(self, config: IngestionConfig):
        super().__init__(config)
        if not SLACK_AVAILABLE:
            raise ImportError("Slack SDK not available")
        self.client = AsyncWebClient(token=config.slack_token)
        
    def get_source_name(self) -> str:
        return "slack"

    def is_configured(self) -> bool:
        return bool(self.config.slack_token and self.config.slack_channels and self.config.slack_channels[0])
    
    async def fetch_data(self) -> List[CanonicalEvent]:
        events = []
        if not self.is_configured():
            print("Warning: No Slack channels configured")
            return events
        
        try:
            oldest = (datetime.now() - timedelta(hours=self.config.lookback_hours)).timestamp()
            for channel_id in self.config.slack_channels:
                if not channel_id: 
                    continue
                try:
                    result = await self.client.conversations_history(
                        channel=channel_id,
                        oldest=str(oldest),
                        limit=self.config.batch_size
                    )
                    messages = result.get("messages", [])
                    channel_info = await self.client.conversations_info(channel=channel_id)
                    channel_name = channel_info["channel"]["name"]
                    
                    user_ids = {msg.get("user") for msg in messages if msg.get("user")}
                    user_info_map = {}
                    user_tasks = [self.client.users_info(user=user_id) for user_id in user_ids]
                    user_results = await asyncio.gather(*user_tasks, return_exceptions=True)
                    
                    for res in user_results:
                        if not isinstance(res, Exception):
                            user_id = res["user"]["id"]
                            user_info_map[user_id] = res["user"].get("real_name", user_id)
                    
                    for msg in messages:
                        if msg.get("bot_id"): 
                            continue
                        user_id = msg.get("user", "unknown")
                        user_name = user_info_map.get(user_id, user_id)
                        event = CanonicalEvent(
                            id=f"slack-{channel_id}-{msg['ts']}",
                            source="slack",
                            channel=f"#{channel_name}",
                            user_id=user_id,
                            user_name=user_name,
                            text=msg.get("text", ""),
                            timestamp=datetime.fromtimestamp(float(msg["ts"])),
                            raw_data=msg
                        )
                        events.append(event)
                except SlackApiError as e:
                    print(f"Error fetching Slack channel {channel_id}: {e}")
                    continue
        except Exception as e:
            print(f"Error in Slack connector: {e}")
            traceback.print_exc()
        return events


# === DISCORD CONNECTOR ===
class DiscordConnector(DataConnector):
    def __init__(self, config: IngestionConfig):
        super().__init__(config)
        if not DISCORD_AVAILABLE:
            raise ImportError("Discord library not available")
        self.client = None
        
    def get_source_name(self) -> str:
        return "discord"

    def is_configured(self) -> bool:
        return bool(self.config.discord_token and self.config.discord_guilds and self.config.discord_guilds[0])
    
    async def fetch_data(self) -> List[CanonicalEvent]:
        events = []
        if not self.is_configured():
            print("Warning: Discord not configured")
            return events
        
        intents = discord.Intents.default()
        intents.messages = True
        intents.message_content = True
        intents.guilds = True
        client = discord.Client(intents=intents)
        fetch_complete = asyncio.Future()

        @client.event
        async def on_ready():
            try:
                print(f"Discord bot connected as {client.user}")
                after = datetime.now() - timedelta(hours=self.config.lookback_hours)
                for guild_id_str in self.config.discord_guilds:
                    if not guild_id_str: 
                        continue
                    guild_id = int(guild_id_str)
                    guild = client.get_guild(guild_id)
                    if not guild: 
                        continue
                    for channel in guild.text_channels:
                        try:
                            async for message in channel.history(limit=self.config.batch_size, after=after):
                                if message.author.bot: 
                                    continue
                                event = CanonicalEvent(
                                    id=f"discord-{guild.id}-{channel.id}-{message.id}",
                                    source="discord",
                                    channel=f"{guild.name}#{channel.name}",
                                    user_id=str(message.author.id),
                                    user_name=message.author.display_name,
                                    text=message.content,
                                    timestamp=message.created_at,
                                    raw_data={
                                        "guild_id": str(guild.id),
                                        "channel_id": str(channel.id),
                                        "message_id": str(message.id),
                                        "attachments": len(message.attachments)
                                    }
                                )
                                events.append(event)
                        except discord.Forbidden:
                            print(f"Warning: No permission for Discord channel {channel.name}")
                        except Exception as e:
                            print(f"Error fetching Discord channel {channel.name}: {e}")
                fetch_complete.set_result(True)
            except Exception as e:
                fetch_complete.set_exception(e)
            finally:
                await client.close()

        try:
            await asyncio.wait_for(client.start(self.config.discord_token), timeout=60.0)
            await asyncio.wait_for(fetch_complete, timeout=300.0)
        except asyncio.TimeoutError:
            print("Error: Discord connection or fetch timed out")
        except Exception as e:
            print(f"Error in Discord connector: {e}")
            traceback.print_exc()
        finally:
            if not client.is_closed():
                await client.close()
        return events


# === TEAMS CONNECTOR ===
class TeamsConnector(DataConnector):
    def __init__(self, config: IngestionConfig):
        super().__init__(config)
        if not TEAMS_AVAILABLE:
            raise ImportError("Microsoft Teams libraries not available")
        self.access_token = None
        self.client = httpx.AsyncClient()

    def get_source_name(self) -> str:
        return "teams"

    def is_configured(self) -> bool:
        return bool(self.config.teams_tenant_id and self.config.teams_client_id and self.config.teams_client_secret)
    
    async def _get_access_token(self) -> str:
        authority = f"https://login.microsoftonline.com/{self.config.teams_tenant_id}"
        app = msal.ConfidentialClientApplication(
            self.config.teams_client_id,
            authority=authority,
            client_credential=self.config.teams_client_secret
        )
        result = app.acquire_token_for_client(scopes=["https://graph.microsoft.com/.default"])
        if "access_token" in result:
            return result["access_token"]
        else:
            raise Exception(f"Failed to get Teams access token: {result.get('error_description')}")

    async def fetch_data(self) -> List[CanonicalEvent]:
        events = []
        if not self.is_configured():
            print("Warning: Microsoft Teams not configured")
            return events
        
        try:
            self.access_token = await self._get_access_token()
            headers = {"Authorization": f"Bearer {self.access_token}"}
            teams_url = "https://graph.microsoft.com/v1.0/groups?$filter=resourceProvisioningOptions/Any(x:x eq 'Team')"
            response = await self.client.get(teams_url, headers=headers)
            response.raise_for_status()
            teams = response.json().get("value", [])
            
            after_iso = (datetime.now() - timedelta(hours=self.config.lookback_hours)).isoformat() + "Z"
            
            for team in teams[:5]:
                team_id = team["id"]
                team_name = team.get("displayName", "Unknown Team")
                channels_url = f"https://graph.microsoft.com/v1.0/teams/{team_id}/channels"
                response = await self.client.get(channels_url, headers=headers)
                channels = response.json().get("value", [])
                
                for channel in channels:
                    channel_id = channel["id"]
                    channel_name = channel.get("displayName", "Unknown Channel")
                    messages_url = f"https://graph.microsoft.com/v1.0/teams/{team_id}/channels/{channel_id}/messages?$filter=createdDateTime gt {after_iso}&$top=50"
                    try:
                        response = await self.client.get(messages_url, headers=headers)
                        if response.status_code == 403:
                            print(f"Warning: No permission for Teams channel {team_name}#{channel_name}")
                            continue
                        response.raise_for_status()
                        messages = response.json().get("value", [])
                        
                        for msg in messages:
                            if not msg.get("from"): 
                                continue
                            created_at = datetime.fromisoformat(msg["createdDateTime"].replace("Z", "+00:00"))
                            from_user = msg.get("from", {}).get("user", {})
                            user_id = from_user.get("id", "unknown")
                            user_name = from_user.get("displayName", "Unknown User")
                            body = msg.get("body", {})
                            text = body.get("content", "")
                            import re
                            text = re.sub(r'<[^>]+>', '', text).strip()
                            event = CanonicalEvent(
                                id=f"teams-{team_id}-{channel_id}-{msg['id']}",
                                source="teams",
                                channel=f"{team_name}#{channel_name}",
                                user_id=user_id,
                                user_name=user_name,
                                text=text,
                                timestamp=created_at,
                                raw_data=msg
                            )
                            events.append(event)
                    except Exception as e:
                        print(f"Error fetching messages for channel {channel_name}: {e}")
        except Exception as e:
            print(f"Error in Teams connector: {e}")
            traceback.print_exc()
        finally:
            await self.client.aclose()
        return events


# === GMAIL CONNECTOR ===
class GmailConnector(DataConnector):
    def __init__(self, config: IngestionConfig):
        super().__init__(config)
        if not GOOGLE_AVAILABLE:
            raise ImportError("Google API libraries not available")
        self.service = None
        
    def get_source_name(self) -> str:
        return "gmail" # This is the internal name, but the event source will be "email"

    def is_configured(self) -> bool:
        return bool(self.config.google_credentials_path and os.path.exists(self.config.google_credentials_path))
    
    async def fetch_data(self) -> List[CanonicalEvent]:
        events = []
        if not self.is_configured():
            print("Warning: Gmail not configured or credentials file missing")
            return events
        
        try:
            # --- THIS IS THE CORRECTED LOGIC ---
            creds = self.config.get_google_creds()
            if not creds:
                print("Warning: Failed to get Google credentials for Gmail")
                return events
            # --- END OF FIX ---
                
            self.service = build('gmail', 'v1', credentials=creds)
            
            after_date = (datetime.now() - timedelta(hours=self.config.lookback_hours)).strftime('%Y/%m/%d')
            query = f"after:{after_date}"
            if self.config.gmail_labels:
                label_query = " OR ".join([f"label:{label}" for label in self.config.gmail_labels if label])
                if label_query:
                    query += f" ({label_query})"
            
            results = self.service.users().messages().list(
                userId='me', q=query, maxResults=self.config.batch_size
            ).execute()
            messages = results.get('messages', [])
            
            for msg_ref in messages:
                try:
                    message = self.service.users().messages().get(
                        userId='me', id=msg_ref['id'], format='full'
                    ).execute()
                    headers = message['payload']['headers']
                    subject = next((h['value'] for h in headers if h['name'] == 'Subject'), 'No Subject')
                    from_email = next((h['value'] for h in headers if h['name'] == 'From'), 'Unknown')
                    date_str = next((h['value'] for h in headers if h['name'] == 'Date'), None)
                    
                    from email.utils import parsedate_to_datetime
                    timestamp = parsedate_to_datetime(date_str) if date_str else datetime.now()
                    
                    body = self._extract_email_body(message['payload'])
                    text = f"Subject: {subject}\n\n{body}"
                    
                    # --- FIX: Change source from "gmail" to "email" to match models.py ---
                    event = CanonicalEvent(
                        id=f"gmail-{message['id']}",
                        source="email", # Was "gmail", now matches CanonicalEvent
                        channel="email",
                        user_id=from_email,
                        user_name=from_email.split('<')[0].strip().replace('"', '') if '<' in from_email else from_email,
                        text=text,
                        timestamp=timestamp,
                        raw_data=message
                    )
                    # --- END OF FIX ---
                    events.append(event)
                except Exception as e:
                    print(f"Error processing email {msg_ref['id']}: {e}")
                    continue
        except Exception as e:
            print(f"Error in Gmail connector: {e}")
            traceback.print_exc()
        return events
    
    def _extract_email_body(self, payload: Dict) -> str:
        if 'body' in payload and 'data' in payload['body']:
            import base64
            return base64.urlsafe_b64decode(payload['body']['data']).decode('utf-8')
        if 'parts' in payload:
            for part in payload['parts']:
                if part.get('mimeType') == 'text/plain':
                    if 'data' in part.get('body', {}):
                        import base64
                        return base64.urlsafe_b64decode(part['body']['data']).decode('utf-8')
                if 'parts' in part:
                    return self._extract_email_body(part)
        return ""


# === GOOGLE DOCS CONNECTOR ===
class GoogleDocsConnector(DataConnector):
    def __init__(self, config: IngestionConfig):
        super().__init__(config)
        if not GOOGLE_AVAILABLE:
            raise ImportError("Google API libraries not available")
        self.service = None
        
    def get_source_name(self) -> str:
        return "gdocs"

    def is_configured(self) -> bool:
        return bool(self.config.google_credentials_path and os.path.exists(self.config.google_credentials_path) and self.config.gdocs_folder_ids and self.config.gdocs_folder_ids[0])
    
    async def fetch_data(self) -> List[CanonicalEvent]:
        events = []
        if not self.is_configured():
            print("Warning: Google Docs not configured or credentials file missing")
            return events
        
        try:
            # --- THIS IS THE CORRECTED LOGIC ---
            creds = self.config.get_google_creds()
            if not creds:
                print("Warning: Failed to get Google credentials for GDocs")
                return events
            # --- END OF FIX ---
            
            drive_service = build('drive', 'v3', credentials=creds)
            docs_service = build('docs', 'v1', credentials=creds)
            
            after_date_iso = (datetime.now() - timedelta(hours=self.config.lookback_hours)).isoformat()
            
            for folder_id in self.config.gdocs_folder_ids:
                if not folder_id: 
                    continue
                # Note: 'drive.metadata.readonly' scope is required for this 'files.list' call
                query = f"'{folder_id}' in parents and mimeType='application/vnd.google-apps.document' and modifiedTime > '{after_date_iso}'"
                results = drive_service.files().list(
                    q=query, pageSize=self.config.batch_size, fields="files(id, name, modifiedTime, owners)"
                ).execute()
                files = results.get('files', [])
                
                for file in files:
                    try:
                        document = docs_service.documents().get(documentId=file['id']).execute()
                        text = self._extract_doc_text(document)
                        owner = file.get('owners', [{}])[0]
                        owner_name = owner.get('displayName', 'Unknown')
                        owner_email = owner.get('emailAddress', 'unknown@example.com')
                        timestamp = datetime.fromisoformat(file['modifiedTime'].replace('Z', '+00:00'))
                        
                        event = CanonicalEvent(
                            id=f"gdocs-{file['id']}",
                            source="gdocs",
                            channel=f"folder-{folder_id}",
                            user_id=owner_email,
                            user_name=owner_name,
                            text=f"Document: {file['name']}\n\n{text}",
                            timestamp=timestamp,
                            raw_data=file
                        )
                        events.append(event)
                    except Exception as e:
                        print(f"Error processing document {file['name']}: {e}")
                        continue
        except Exception as e:
            print(f"Error in Google Docs connector: {e}")
            traceback.print_exc()
        return events
    
    def _extract_doc_text(self, document: Dict) -> str:
        text_parts = []
        for element in document.get('body', {}).get('content', []):
            if 'paragraph' in element:
                paragraph = element['paragraph']
                for text_run in paragraph.get('elements', []):
                    if 'textRun' in text_run:
                        text_parts.append(text_run['textRun'].get('content', ''))
        return ''.join(text_parts)


# === NOTION CONNECTOR ===
class NotionConnector(DataConnector):
    def __init__(self, config: IngestionConfig):
        super().__init__(config)
        if not NOTION_AVAILABLE:
            raise ImportError("Notion client not available")
        self.client = NotionAsyncClient(auth=config.notion_token)
        
    def get_source_name(self) -> str:
        return "notion"

    def is_configured(self) -> bool:
        return bool(self.config.notion_token and self.config.notion_database_ids and self.config.notion_database_ids[0])
    
    async def fetch_data(self) -> List[CanonicalEvent]:
        events = []
        if not self.is_configured():
            print("Warning: Notion not configured")
            return events

        try:
            after_time = (datetime.now() - timedelta(hours=self.config.lookback_hours)).isoformat()
            for db_id in self.config.notion_database_ids:
                if not db_id: 
                    continue
                try:
                    response = await self.client.databases.query(
                        database_id=db_id,
                        filter={"timestamp": "last_edited_time", "last_edited_time": {"after": after_time}},
                        page_size=self.config.batch_size
                    )
                    for page in response.get("results", []):
                        page_id = page["id"]
                        text = await self._extract_notion_page_text(page_id)
                        title_prop = page.get("properties", {}).get("title", {})
                        if "title" in title_prop and title_prop["title"]:
                            title = title_prop["title"][0].get("plain_text", "No Title")
                        else:
                            title = "No Title"
                        user = page.get("created_by", {})
                        user_id = user.get("id", "unknown")
                        timestamp = datetime.fromisoformat(page["last_edited_time"].replace("Z", "+00:00"))
                        
                        event = CanonicalEvent(
                            id=f"notion-{page_id}",
                            source="notion",
                            channel=f"db-{db_id}",
                            user_id=user_id,
                            user_name=user_id,
                            text=f"Notion Page: {title}\n\n{text}",
                            timestamp=timestamp,
                            raw_data=page
                        )
                        events.append(event)
                except Exception as e:
                    print(f"Error processing Notion database {db_id}: {e}")
                    continue
        except Exception as e:
            print(f"Error in Notion connector: {e}")
            traceback.print_exc()
        return events

    async def _extract_notion_page_text(self, page_id: str) -> str:
        text_parts = []
        try:
            response = await self.client.blocks.children.list(block_id=page_id)
            for block in response.get("results", []):
                block_type = block.get("type")
                if block_type in block and "rich_text" in block[block_type]:
                    for text_item in block[block_type]["rich_text"]:
                        if "plain_text" in text_item:
                            text_parts.append(text_item["plain_text"])
        except Exception as e:
            print(f"Error extracting text from Notion page {page_id}: {e}")
        return "\n".join(text_parts)


# === LOCAL FILE CONNECTOR ===
class LocalFileConnector(DataConnector):
    def __init__(self, config: IngestionConfig):
        super().__init__(config)
        self.upload_dir = Path(config.local_upload_dir)
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        
    def get_source_name(self) -> str:
        return "local_files"

    def is_configured(self) -> bool:
        return True
    
    async def fetch_data(self) -> List[CanonicalEvent]:
        events = []
        if not self.upload_dir.exists():
            print("Warning: Local upload directory not found")
            return events

        after_time = datetime.now() - timedelta(hours=self.config.lookback_hours)
        for file_path in self.upload_dir.rglob('*'):
            if file_path.is_file():
                try:
                    mod_time = datetime.fromtimestamp(file_path.stat().st_mtime)
                    if mod_time < after_time:
                        continue
                    
                    text = ""
                    if file_path.suffix == '.pdf' and PYPDF_AVAILABLE:
                        text = self._read_pdf(file_path)
                    elif file_path.suffix == '.docx' and DOCX_AVAILABLE:
                        text = self._read_docx(file_path)
                    elif file_path.suffix == '.txt':
                        text = file_path.read_text(encoding='utf-8')
                    else:
                        continue
                    
                    if not text: 
                        continue
                    
                    event = CanonicalEvent(
                        id=f"file-{hashlib.md5(str(file_path).encode()).hexdigest()}",
                        source="local_files",
                        channel="uploads",
                        user_id="file_system",
                        user_name="Local Upload",
                        text=f"Document: {file_path.name}\n\n{text}",
                        timestamp=mod_time,
                        raw_data={"file_path": str(file_path), "file_name": file_path.name}
                    )
                    events.append(event)
                except Exception as e:
                    print(f"Error processing local file {file_path}: {e}")
        return events

    def _read_pdf(self, file_path: Path) -> str:
        text_parts = []
        with open(file_path, 'rb') as f:
            reader = pypdf.PdfReader(f)
            for page in reader.pages:
                text_parts.append(page.extract_text())
        return "\n".join(text_parts)

    def _read_docx(self, file_path: Path) -> str:
        doc = docx.Document(file_path)
        return "\n".join([para.text for para in doc.paragraphs])


# === JIRA CONNECTOR ===
class JiraConnector(DataConnector):
    def __init__(self, config: IngestionConfig):
        super().__init__(config)
        self.service = jira_service
        
    def get_source_name(self) -> str:
        return "jira"
    
    def is_configured(self) -> bool:
        return self.service.is_configured() and bool(self.config.jira_project_keys and self.config.jira_project_keys[0])
    
    async def fetch_data(self) -> List[CanonicalEvent]:
        """Fetch recently updated issues from Jira"""
        events = []
        if not self.is_configured():
            print("Warning: Jira connector not configured")
            return events
        
        try:
            for project_key in self.config.jira_project_keys:
                if not project_key: 
                    continue
                print(f" → Fetching issues for Jira project: {project_key}")
                issues = self.service.get_recent_issues(project_key, self.config.lookback_hours)
                
                for issue in issues:
                    text = f"Jira Issue: {issue['summary']}\n\n{issue['description']}"
                    event = CanonicalEvent(
                        id=f"jira-{issue['id']}",
                        source="jira",
                        channel=f"project-{project_key}",
                        user_id=issue['assignee_id'],
                        user_name=issue['assignee_name'],
                        text=text,
                        timestamp=datetime.fromisoformat(issue['updated_at'].replace("Z", "+00:00")),
                        raw_data=issue['raw']
                    )
                    events.append(event)
        except JIRAError as e:
            print(f"Error in Jira connector: {e.text}")
        except Exception as e:
            print(f"Error in Jira connector: {e}")
            traceback.print_exc()
        return events


# === MULTI-CHANNEL INGESTION SERVICE ===
class MultiChannelIngestionService:
    def __init__(
        self,
        config: Optional[IngestionConfig] = None,
        vector_store: Optional[VectorStore] = None,
        graph_store: Optional[GraphStore] = None
    ):
        self.config = config or IngestionConfig()
        self.vector_store = vector_store or VectorStore()
        self.graph_store = graph_store or GraphStore()
        self.connectors: Dict[str, DataConnector] = {}
        self._init_connectors()
        
    def _init_connectors(self):
        connector_classes = [
            SlackConnector,
            DiscordConnector,
            TeamsConnector,
            GmailConnector,
            GoogleDocsConnector,
            NotionConnector,
            LocalFileConnector,
            JiraConnector
        ]
        
        for connector_cls in connector_classes:
            try:
                connector = connector_cls(self.config)
                self.connectors[connector.get_source_name()] = connector
                print(f"✓ {connector.get_source_name()} connector initialized")
            except ImportError as e:
                print(f"⚠ Failed to initialize {connector_cls.__name__}: {e}")
            except Exception as e:
                print(f"⚠ Failed to initialize {connector_cls.__name__}: {e}")

    def get_connector_status(self) -> List[Dict[str, Any]]:
        """
        Get status of all connectors
        
        FIXED: Now returns the correct structure matching the ConnectorStatus model
        with the required 'status' field instead of 'configured'
        """
        statuses = []
        for source_name, connector in self.connectors.items():
            is_configured = connector.is_configured()
            
            # Determine a status string based on configuration
            if is_configured:
                status_str = "configured"
            else:
                status_str = "not_configured"
            
            statuses.append({
                "source": source_name,
                "status": status_str,      # ADDED: Required field
                "last_run": None,          # ADDED: Optional field (can be populated later)
                "error": None              # ADDED: Optional field (can be populated later)
            })
        
        return statuses
    
    async def run_ingestion_for_source(self, source_name: str) -> Dict[str, Any]:
        """Run ingestion for a specific source"""
        print(f"\n{'='*60}")
        print(f"SINGLE-CHANNEL INGESTION STARTED: {source_name}")
        print(f"{'='*60}")
        
        connector = self.connectors.get(source_name)
        
        if not connector:
            return {
                "status": "error",
                "message": f"Connector '{source_name}' not found.",
                "source": source_name
            }
        
        if not connector.is_configured():
            return {
                "status": "error",
                "message": f"Connector '{source_name}' is not configured.",
                "source": source_name
            }
        
        start_time = datetime.now()
        stats = {
            "source": source_name,
            "status": "pending",
            "total_events": 0,
            "vectors_inserted": 0,
            "duration_seconds": 0,
            "error": None
        }
        
        try:
            events = await connector.fetch_data()
            stats["total_events"] = len(events)
            
            if not events:
                print(f"ℹ No new events found for {source_name}")
                stats["status"] = "success_no_data"
                return stats
            
            print(f"✓ Fetched {len(events)} events from {source_name}")
            
            processing_stats = await self.process_and_store_events(events)
            stats.update(processing_stats)
            stats["status"] = "success"
            
        except Exception as e:
            print(f"❌ Error during {source_name} ingestion: {e}")
            traceback.print_exc()
            stats["error"] = str(e)
            stats["status"] = "error"
        
        end_time = datetime.now()
        stats["duration_seconds"] = (end_time - start_time).total_seconds()
        
        print(f"\n{'='*60}")
        print(f"INGESTION COMPLETED: {source_name} in {stats['duration_seconds']:.2f}s")
        print(f"{'='*60}\n")
        
        return stats

    async def process_and_store_events(self, events: List[CanonicalEvent]) -> Dict[str, Any]:
        """Process events and store in vector and graph databases"""
        print(f"🔄 Processing {len(events)} events...")
        
        # Extract entities and sentiment
        extractions = []
        for event in events:
            extraction = extractor_service.extract_all(event) 
            
            if not self.config.use_sentiment:
                extraction['sentiment'] = {'label': 'neutral', 'score': 0.0}
            
            if not self.config.use_pii_redaction:
                    extraction['redacted_text'] = event.text
                    
            extractions.append(extraction)
        
        print(f"✓ Extracted data from {len(extractions)} events")
        
        # Generate embeddings
        text_to_embed = [
            ext.get('redacted_text', '')
            for ext in extractions
        ]
        embeddings = embedding_service.get_embeddings(text_to_embed)
        print(f"✓ Generated {len(embeddings)} embeddings")
        
        # Store in Milvus
        milvus_data = self._prepare_milvus_data(events, embeddings, extractions)
        vectors_inserted = self.vector_store.insert_events(events, extractions)
        print(f"✓ Inserted {vectors_inserted} vectors into Milvus")
        
        # Store in Neo4j
        await self.graph_store.insert_events_graph(events, extractions)
        await self.graph_store.assign_tasks_to_users()
        await self.graph_store.create_agreement_links()
        print(f"✓ Inserted events into Neo4j graph")
        
        return {
            "vectors_inserted": vectors_inserted,
            "graph_nodes_processed": len(events)
        }
    
    def _prepare_milvus_data(
        self, 
        events: List[CanonicalEvent], 
        embeddings: List[List[float]], 
        extractions: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Prepare data for Milvus insertion"""
        milvus_data = []
        
        for i, event in enumerate(events):
            sentiment = extractions[i].get('sentiment', {'label': 'neutral', 'score': 0.0})
            embedding = embeddings[i] if i < len(embeddings) else [0.0] * 384
            
            if len(embedding) != 384:
                continue
            
            timestamp_unix = int(event.timestamp.timestamp())
            redacted_text = extractions[i].get('redacted_text', '')
            
            milvus_data.append({
                "event_id": str(event.id),
                "embedding": embedding,
                "text": str(redacted_text if self.config.use_pii_redaction else event.text)[:65535],
                "source": str(event.source)[:100],
                "channel": str(event.channel or "unknown")[:256],
                "user_name": str(event.user_name or event.user_id)[:256],
                "timestamp": timestamp_unix,
                "sentiment_label": str(sentiment.get('label', 'neutral'))[:50],
                "sentiment_score": float(sentiment.get('score', 0.0))
            })
        
        return milvus_data


# === CLI RUNNER ===
if __name__ == "__main__":
    import sys
    
    print("="*60)
    print("Multi-Channel Ingestion Service - CLI Mode")
    print("="*60)
    
    config = IngestionConfig()
    service = MultiChannelIngestionService(config)
    
    async def main():
        if len(sys.argv) > 1:
            source_to_run = sys.argv[1]
            print(f"\n→ Running ingestion for: {source_to_run}")
            stats = await service.run_ingestion_for_source(source_to_run)
        else:
            print("\n→ Checking connector status for all sources")
            print("\nAvailable sources:")
            print("  slack, discord, teams, gmail, gdocs, notion, local_files, jira")
            print("\nUsage: python multi_channel_ingestion.py <source_name>")
            stats = service.get_connector_status()
        
        print("\n" + "="*60)
        print("Final Statistics:")
        print("="*60)
        print(json.dumps(stats, indent=2))
    
    asyncio.run(main())