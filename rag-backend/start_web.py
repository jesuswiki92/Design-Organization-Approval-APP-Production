"""
Launch script for the RAG Aeronautica web application.

Usage:
    python start_web.py          # Start FastAPI backend on port 3002
    python start_web.py --port 8000  # Custom port

For development:
    1. python start_web.py                       (backend on :3002)
"""

import argparse
import sys
from pathlib import Path

# Fix Windows console encoding: allow UTF-8 output with fallback for unsupported chars
if sys.platform == "win32":
    for stream_name in ("stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        if stream and hasattr(stream, "reconfigure"):
            try:
                stream.reconfigure(encoding="utf-8", errors="replace")
            except Exception:
                pass

# Ensure project root is in path
sys.path.insert(0, str(Path(__file__).resolve().parent))


def main():
    parser = argparse.ArgumentParser(description="RAG Aeronautica Web Server")
    parser.add_argument("--port", type=int, default=3002, help="Port (default: 3002)")
    parser.add_argument("--host", default="0.0.0.0", help="Host (default: 0.0.0.0)")
    parser.add_argument("--reload", action="store_true", help="Auto-reload on changes")
    args = parser.parse_args()

    import uvicorn
    print(f"\n  RAG Aeronautica API starting on http://{args.host}:{args.port}")
    print("  Isolated backend copy for TCDS RAG\n")
    uvicorn.run(
        "api.server:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
    )


if __name__ == "__main__":
    main()
