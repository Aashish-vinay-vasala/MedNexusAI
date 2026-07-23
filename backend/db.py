import os

import httpx
from dotenv import load_dotenv
from supabase import create_client, Client, ClientOptions

load_dotenv()

_url = os.getenv("SUPABASE_URL")
_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


def require_db() -> Client:
    """Returns a fresh Supabase client per call rather than a shared singleton, with
    automatic retries on the underlying transport.

    FastAPI dispatches sync route handlers to a worker threadpool; a browser loading
    a page fires several requests concurrently (e.g. diagnoses + medications + vitals
    on patient select), and on Windows this occasionally trips a transient
    `httpx.ReadError: [WinError 10035]` (WSAEWOULDBLOCK) on one of the concurrent
    sockets. Enabling transport-level retries absorbs that instead of surfacing a
    500 to the browser."""
    if not _url or not _key:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="Database not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing)")
    httpx_client = httpx.Client(
        transport=httpx.HTTPTransport(retries=3),
        limits=httpx.Limits(max_connections=20, max_keepalive_connections=0),
        timeout=30,
    )
    return create_client(_url, _key, options=ClientOptions(httpx_client=httpx_client))
