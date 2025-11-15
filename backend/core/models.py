"""
Shared data models for Context IQ.
This module contains all Pydantic models to avoid circular imports.
"""
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from typing import Literal, Optional, List, Any # Added List and Any


class CanonicalEvent(BaseModel):
    """
    The normalized format for any piece of communication.
    This is the single, unified format for all data in our system.
    """
    model_config = ConfigDict(arbitrary_types_allowed=True)
    
    id: str = Field(..., description="Unique ID of the event (e.g., message ID)")
    
    # --- FIX: Added all new sources from multi_channel_ingestion.py ---
    source: Literal[
    "slack", "zoom", "notion", "email", "gdocs", 
    "jira", "discord", "teams", "local_files", "gmail"
]
    # --- End of fix ---

    channel: Optional[str] = Field(None, description="e.g., Slack channel or meeting name")
    user_id: str
    user_name: Optional[str] = None
    text: str
    timestamp: datetime
    raw_data: dict  # The original, unprocessed JSON/dict
    

# --- Authentication Models ---

class Token(BaseModel):
    """Pydantic model for the access token."""
    access_token: str
    token_type: str

class TokenData(BaseModel):
    """Pydantic model for the data stored in the token."""
    username: Optional[str] = None

class User(BaseModel):
    """Pydantic model for user signup and base info."""
    username: str
    email: str
    full_name: Optional[str] = None
    role: str  # 'user', 'admin', 'manager'
    
class UserCreate(User):
    """Pydantic model for creating a new user."""
    password: str

class UserInDB(User):
    """Pydantic model for a user as stored in the database."""
    hashed_password: str

# --- FIX: Added the missing Insight class ---
class Insight(BaseModel):
    """
    Pydantic model for a proactive insight.
    """
    id: str = Field(..., description="Unique ID for the insight (e.g., 'daily_isolated_decisions')")
    title: str = Field(..., description="A short, human-readable title for the insight.")
    description: str = Field(..., description="A longer description of what was found.")
    source_type: str = Field(..., description="What generated this? e.g., 'proactive_analysis', 'user_request'")
    content: Any = Field(..., description="The data for the insight (e.g., list of nodes, stats).")
    recommendations: List[str] = Field(default_factory=list, description="Actionable recommendations.")
    timestamp: datetime = Field(default_factory=datetime.now)
# --- End of fix ---