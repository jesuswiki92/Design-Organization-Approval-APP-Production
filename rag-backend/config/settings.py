"""
Central application configuration.
Loads credentials from .env file
"""
import os
from pathlib import Path
from urllib.parse import quote
from dotenv import load_dotenv

# Load environment variables from .env
BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / ".env"
load_dotenv(ENV_PATH)


class Settings:
    """Class with all application configurations."""
    BASE_DIR = BASE_DIR

    # === APP INFO ===
    APP_NAME = "RAG Aeronatic Final"
    APP_VERSION = "1.0.0"

    # === LOGGING ===
    LOG_TO_FILE = os.getenv("LOG_TO_FILE", "false").lower() in ("1", "true", "yes", "y")

    # === AI APIs ===
    MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY", "")
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
    COHERE_API_KEY = os.getenv("COHERE_API_KEY", "")
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
    OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")

    # === AUTH ===
    ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
    ADMIN_PASSWORD_HASH = os.getenv("ADMIN_PASSWORD_HASH", "")
    JWT_SECRET = os.getenv("JWT_SECRET", "")
    JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "8"))
    PRODUCTION = os.getenv("PRODUCTION", "false").lower() in ("1", "true", "yes")

    # === SUPABASE ===
    SUPABASE_URL = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
    SUPABASE_TABLE = os.getenv("SUPABASE_TABLE", "doa_tcds_embeddings")
    SUPABASE_STORAGE_BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET", "doa-tcds-storage")

    # === PROCESSING CONFIG ===
    LARGE_DOC_THRESHOLD = 50
    CHUNK_SIZE = 30000
    CHUNK_OVERLAP = 2000

    # === AI MODELS ===
    EMBEDDING_MODEL = os.getenv('EMBEDDING_MODEL', 'text-embedding-3-large')
    EMBEDDING_DIM = int(os.getenv('EMBEDDING_DIM', '3072'))
    OPENAI_EMBEDDING_MODEL = EMBEDDING_MODEL
    OPENAI_CHAT_MODEL = "gpt-4o"
    SEMANTIC_CHUNKER_MODEL = os.getenv("SEMANTIC_CHUNKER_MODEL", "gpt-5.2")
    ANTHROPIC_CHAT_MODEL = "claude-sonnet-4-5-20250929"
    USE_CLAUDE_FOR_CHAT = True
    MISTRAL_OCR_MODEL = "mistral-ocr-latest"
    GEMINI_MODEL = "gemini-2.0-flash"
    COHERE_RERANK_MODEL = "rerank-v3.5"

    # === LOCAL STORAGE / ASSETS ===
    PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "http://localhost:3002")
    ALLOWED_ORIGINS = [
        origin.strip()
        for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:3002").split(",")
        if origin.strip()
    ]
    TEMP_DIR = BASE_DIR / "temp"
    LOCAL_STORAGE_DIR = BASE_DIR / ".tmp" / "storage"
    LOCAL_IMAGES_DIR = LOCAL_STORAGE_DIR / "images"
    LOCAL_CAPTURES_DIR = LOCAL_STORAGE_DIR / "captures"

    @classmethod
    def ensure_local_paths(cls) -> None:
        cls.TEMP_DIR.mkdir(parents=True, exist_ok=True)
        cls.LOCAL_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
        cls.LOCAL_IMAGES_DIR.mkdir(parents=True, exist_ok=True)
        cls.LOCAL_CAPTURES_DIR.mkdir(parents=True, exist_ok=True)

    @classmethod
    def build_asset_url(cls, kind: str, file_name: str) -> str:
        base = cls.PUBLIC_BASE_URL.rstrip("/")
        safe_name = quote(file_name)
        return f"{base}/api/assets/{kind}/{safe_name}"

    @classmethod
    def validate(cls) -> dict:
        """Check which credentials are configured."""
        return {
            "OpenAI": bool(cls.OPENAI_API_KEY),
            "Mistral AI": bool(cls.MISTRAL_API_KEY),
            "Google Gemini": bool(cls.GOOGLE_API_KEY),
            "Cohere": bool(cls.COHERE_API_KEY),
            "Anthropic": bool(cls.ANTHROPIC_API_KEY),
            "OpenRouter": bool(cls.OPENROUTER_API_KEY),
            "Supabase": bool(cls.SUPABASE_URL and cls.SUPABASE_KEY),
        }

    @classmethod
    def get_missing_credentials(cls) -> list:
        """Return list of missing credentials."""
        validation = cls.validate()
        required = {"Mistral AI", "Google Gemini", "Cohere", "Anthropic", "OpenRouter", "Supabase"}
        return [name for name, is_valid in validation.items() if name in required and not is_valid]


# Global settings instance
settings = Settings()
settings.ensure_local_paths()
