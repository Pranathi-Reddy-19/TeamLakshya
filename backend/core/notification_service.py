# backend/core/notification_service.py
import asyncio
from fastapi import WebSocket
from typing import Dict, List, Any
import json

class NotificationService:
    """
    Manages active WebSocket connections and broadcasts messages.
    Uses a singleton pattern.
    """
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            print("🧠 Initializing NotificationService...")
            cls._instance = super(NotificationService, cls).__new__(cls)
            # This holds a map of user_id -> WebSocket connection
            cls._instance.active_connections: Dict[str, WebSocket] = {}
        return cls._instance

    async def connect(self, websocket: WebSocket, user_id: str):
        """
        Registers a WebSocket connection.
        IMPORTANT: The websocket has already been accepted in main.py
        """
        self.active_connections[user_id] = websocket
        print(f"✓ WebSocket connected for user: {user_id} (Total: {len(self.active_connections)})")

    def disconnect(self, user_id: str):
        """
        Removes a WebSocket connection.
        """
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            print(f"WebSocket disconnected for user: {user_id} (Total: {len(self.active_connections)})")

    async def send_to_user(self, user_id: str, message_data: Dict[str, Any]):
        """
        Sends a JSON message to a specific connected user.
        """
        websocket = self.active_connections.get(user_id)
        if websocket:
            try:
                await websocket.send_text(json.dumps(message_data))
                print(f"✓ Sent notification to {user_id}: {message_data['type']}")
            except Exception as e:
                # Handle cases where the connection might be broken
                print(f"❌ Error sending to {user_id}: {e}. Disconnecting.")
                self.disconnect(user_id)
        else:
            print(f"⚠️ User {user_id} not connected. Cannot send notification.")

    async def broadcast(self, message_data: Dict[str, Any]):
        """
        Sends a JSON message to all connected users.
        """
        print(f"Broadcasting message: {message_data['type']}")
        message = json.dumps(message_data)
        # We must iterate over a copy, as disconnects can modify the dict during iteration
        for user_id, websocket in list(self.active_connections.items()):
            try:
                await websocket.send_text(message)
            except Exception as e:
                print(f"❌ Error broadcasting to {user_id}: {e}. Disconnecting.")
                self.disconnect(user_id)

# Singleton instance
notification_service = NotificationService()