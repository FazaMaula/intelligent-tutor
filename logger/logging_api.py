"""
FastAPI logging service — digunakan oleh web app untuk mencatat sesi dan giliran.

Jalankan dari root direktori proyek:
    python3 -m uvicorn logger.logging_api:app --port 8001

Endpoint:
    POST /session/start   → buat sesi baru, kembalikan session_id
    POST /session/end     → tandai sesi selesai
    POST /turn            → catat satu giliran percakapan
    GET  /metrics         → kembalikan metrik terkini
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from logger.session_logger import end_session, log_turn, start_session
from analytics.metrics import compute_metrics

app = FastAPI(title="Tutor Cerdas — Logging API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


class StartRequest(BaseModel):
    provider: str
    client_type: str = "web"
    nama_lengkap: str | None = None
    nomor_induk: str | None = None


class TurnRequest(BaseModel):
    session_id: str
    turn_number: int
    role: str
    content: str
    hint_level: int | None = None


class EndRequest(BaseModel):
    session_id: str
    resolved: bool = False


@app.post("/session/start")
def api_start(req: StartRequest):
    session_id = start_session(req.provider, req.client_type, req.nama_lengkap, req.nomor_induk)
    return {"session_id": session_id}


@app.post("/session/end")
def api_end(req: EndRequest):
    end_session(req.session_id, req.resolved)
    return {"ok": True}


@app.post("/turn")
def api_turn(req: TurnRequest):
    log_turn(req.session_id, req.turn_number, req.role, req.content, req.hint_level)
    return {"ok": True}


@app.get("/metrics")
def api_metrics():
    return compute_metrics()
