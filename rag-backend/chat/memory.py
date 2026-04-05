"""
Conversation memory for chat.
Persists chat history in Supabase.
"""

import uuid
from dataclasses import dataclass, field
from typing import List, Optional
from datetime import datetime

from database.supabase_client import SupabaseClient


@dataclass
class Message:
    """Represents a message in the conversation."""
    role: str  # "user" or "assistant"
    content: str
    timestamp: datetime = field(default_factory=datetime.now)


class ConversationMemory:
    """
    Manages conversation memory with Supabase persistence.
    """
    
    def __init__(self, max_messages: int = 20, session_id: Optional[str] = None):
        """
        Initialize memory.
        
        Args:
            max_messages: Maximum messages to keep in context
            session_id: Session ID (generated if not provided)
        """
        self.max_messages = max_messages
        self.messages: List[Message] = []
        self.session_id: str = session_id or str(uuid.uuid4())
        self.created_at: datetime = datetime.now()
        
        # Initialize Supabase client
        try:
            self.db = SupabaseClient()
            self._load_from_db()
        except Exception as e:
            print(f"Warning: Could not connect to Supabase for memory: {e}")
            self.db = None
    
    def _load_from_db(self) -> None:
        """Load conversation history from Supabase."""
        if not self.db:
            return
        
        try:
            response = self.db.client.table("chat_history")\
                .select("message, created_at")\
                .eq("session_id", self.session_id)\
                .order("created_at", desc=False)\
                .limit(self.max_messages)\
                .execute()
            
            self.messages = []
            for item in response.data:
                msg_data = item.get("message", {})
                self.messages.append(Message(
                    role=msg_data.get("role", "user"),
                    content=msg_data.get("content", ""),
                    timestamp=datetime.fromisoformat(item.get("created_at", datetime.now().isoformat()).replace("Z", "+00:00"))
                ))
        except Exception as e:
            print(f"Error loading chat history: {e}")
    
    def _save_to_db(self, role: str, content: str) -> None:
        """Save a message to Supabase."""
        if not self.db:
            return
        
        try:
            self.db.client.table("chat_history").insert({
                "session_id": self.session_id,
                "message": {
                    "role": role,
                    "content": content
                }
            }).execute()
        except Exception as e:
            print(f"Error saving to chat history: {e}")
    
    def add_user_message(self, content: str) -> None:
        """Add a user message."""
        self._add_message("user", content)
    
    def add_assistant_message(self, content: str) -> None:
        """Add an assistant message."""
        self._add_message("assistant", content)
    
    def _add_message(self, role: str, content: str) -> None:
        """Add a message and save to DB."""
        message = Message(role=role, content=content)
        self.messages.append(message)
        
        # Save to Supabase
        self._save_to_db(role, content)
        
        # Keep message limit in memory (DB keeps all)
        if len(self.messages) > self.max_messages:
            self.messages = self.messages[-self.max_messages:]
    
    def get_history(self) -> List[dict]:
        """
        Return history in API format.
        
        Returns:
            List of dicts with 'role' and 'content'
        """
        return [
            {"role": msg.role, "content": msg.content}
            for msg in self.messages
        ]
    
    def get_history_text(self) -> str:
        """Return history as formatted text."""
        lines = []
        for msg in self.messages:
            prefix = "User" if msg.role == "user" else "Assistant"
            lines.append(f"{prefix}: {msg.content}")
        return "\n\n".join(lines)
    
    def get_last_n_messages(self, n: int) -> List[dict]:
        """Return last n messages."""
        return self.get_history()[-n:]
    
    def clear(self) -> None:
        """Clear all memory (both local and DB)."""
        self.messages = []
        
        if self.db:
            try:
                self.db.client.table("chat_history")\
                    .delete()\
                    .eq("session_id", self.session_id)\
                    .execute()
            except Exception as e:
                print(f"Error clearing chat history: {e}")
    
    def new_session(self) -> str:
        """Start a new session and return the new session ID."""
        self.session_id = str(uuid.uuid4())
        self.messages = []
        self.created_at = datetime.now()
        return self.session_id
    
    def load_session(self, session_id: str) -> bool:
        """Load an existing session."""
        self.session_id = session_id
        self._load_from_db()
        return len(self.messages) > 0
    
    def get_context_for_prompt(self, max_chars: int = 4000) -> str:
        """Get conversation context for prompt."""
        if not self.messages:
            return ""
        
        context_parts = []
        total_chars = 0
        
        for msg in reversed(self.messages[:-1]):
            prefix = "User" if msg.role == "user" else "Assistant"
            text = f"{prefix}: {msg.content}"
            
            if total_chars + len(text) > max_chars:
                break
            
            context_parts.insert(0, text)
            total_chars += len(text)
        
        if context_parts:
            return "### Previous conversation:\n" + "\n".join(context_parts)
        return ""
    
    @property
    def message_count(self) -> int:
        """Number of messages in memory."""
        return len(self.messages)
    
    @property
    def is_empty(self) -> bool:
        """Check if memory is empty."""
        return len(self.messages) == 0
    
    @staticmethod
    def get_recent_sessions(limit: int = 10) -> List[dict]:
        """Get list of recent sessions from DB."""
        try:
            db = SupabaseClient()
            response = db.client.table("chat_history")\
                .select("session_id, created_at")\
                .order("created_at", desc=True)\
                .limit(limit * 2)\
                .execute()
            
            # Get unique sessions
            seen = set()
            sessions = []
            for item in response.data:
                sid = item.get("session_id")
                if sid and sid not in seen:
                    seen.add(sid)
                    sessions.append({
                        "session_id": sid,
                        "created_at": item.get("created_at")
                    })
                    if len(sessions) >= limit:
                        break
            
            return sessions
        except Exception as e:
            print(f"Error getting sessions: {e}")
            return []