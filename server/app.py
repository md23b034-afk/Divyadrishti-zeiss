"""DivyaDrishti bridge server: the link between field phones and remote optometrists.

Field phones POST cases (store-and-forward, idempotent on the client case id).
Optometrists review them in the portal by triage lane, with a response-time
target per lane. Reviews flow back to the phone and on to the patient's Vision
Passport. Every case can be exported as a FHIR R4 bundle.

Privacy by design:
- The server stores clinical data under a pseudonymous case id. The patient's
  name, phone and village arrive sealed to the hub's public key (only the
  optometrist's browser can open them) or not at all. Plaintext identity in a
  non-demo case is stripped on arrival.
- Every read, review, export and erasure is written to an append-only audit log
  (no personal data in it).
- Reviewed cases are purged after DD_RETENTION_DAYS (default 180).
- Security headers on every response; API responses are never cached.

Run:  uvicorn server.app:app --reload --port 8000   (from the repo root)
"""
from __future__ import annotations

import base64
import hashlib
import json
import logging
import os
import sqlite3
import threading
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from statistics import median
from typing import Any, Literal, Optional

import httpx
from fastapi import FastAPI, Header, HTTPException, Query, Request
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .fhir import case_to_bundle

VERSION = "0.3.0"
ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web"
DB_PATH = Path(os.environ.get("DD_DB", ROOT / "server" / "data" / "divyadrishti.db"))
SEED_FILE = ROOT / "server" / "seed_cases.json"
SEED = os.environ.get("DD_SEED", "1") == "1"
PORTAL_TOKEN = os.environ.get("DD_PORTAL_TOKEN")  # set in production: required for review / delete / hub key
RETENTION_DAYS = int(os.environ.get("DD_RETENTION_DAYS", "180"))
MAX_CASE_BYTES = 512_000
LANGS = ("en", "hi", "ta", "te", "mr", "kn")
SARVAM_LANGUAGES = {
    "en": "en-IN",
    "hi": "hi-IN",
    "ta": "ta-IN",
    "te": "te-IN",
    "mr": "mr-IN",
    "kn": "kn-IN",
}
SARVAM_TTS_MODEL = "bulbul:v3"
SARVAM_STT_MODEL = "saaras:v4"
SARVAM_MAX_TEXT_CHARS = 2500
SARVAM_MAX_AUDIO_BYTES = 8 * 1024 * 1024
logger = logging.getLogger(__name__)

SLA_HOURS = {"red": 2, "amber": 24, "green": 72}
LANE_ORDER = {"red": 0, "amber": 1, "green": 2}
DECISIONS = {
    "approve": "Approved",
    "modify": "Approved with changes",
    "in_person": "In-person examination",
    "urgent": "Urgent referral",
}

CSP = "; ".join([
    "default-src 'self'",
    "script-src 'self' https://cdn.jsdelivr.net 'wasm-unsafe-eval'",
    "connect-src 'self' https://cdn.jsdelivr.net https://storage.googleapis.com",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "style-src 'self' 'unsafe-inline'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
])


def now() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.isoformat(timespec="seconds")


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def jwk_thumbprint(jwk: dict) -> str:
    """RFC 7638 thumbprint, identical to the browser's computation."""
    canon = json.dumps({"crv": jwk["crv"], "kty": jwk["kty"], "x": jwk["x"], "y": jwk["y"]}, separators=(",", ":"))
    return b64url(hashlib.sha256(canon.encode()).digest())


# ---------------------------------------------------------------- storage
class Store:
    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.lock = threading.Lock()
        self.db = sqlite3.connect(str(path), check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.db.executescript(
            """CREATE TABLE IF NOT EXISTS cases (
                id TEXT PRIMARY KEY, created_at TEXT, received_at TEXT, lane TEXT, status TEXT,
                patient_name TEXT, age INTEGER, village TEXT, site_name TEXT, demo INTEGER,
                payload TEXT NOT NULL, review TEXT, reviewed_at TEXT);
            CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
            CREATE TABLE IF NOT EXISTS audit (
                id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT, actor TEXT, action TEXT, case_id TEXT, detail TEXT);"""
        )
        self.db.commit()
        self.last_purge: Optional[datetime] = None

    def count(self) -> int:
        with self.lock:
            return self.db.execute("SELECT COUNT(*) FROM cases").fetchone()[0]

    def get(self, case_id: str) -> Optional[sqlite3.Row]:
        with self.lock:
            return self.db.execute("SELECT * FROM cases WHERE id = ?", (case_id,)).fetchone()

    def insert(self, payload: dict, received_at: datetime, review: Optional[dict] = None) -> None:
        p = payload.get("patient") or {}
        lane = payload["profile"]["triage"]["lane"]
        with self.lock:
            self.db.execute(
                "INSERT INTO cases VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (
                    payload["id"], payload.get("createdAt"), iso(received_at), lane,
                    "reviewed" if review else "new", p.get("name"), p.get("age"), p.get("pin") or p.get("village"),
                    (payload.get("site") or {}).get("name"), int(bool(payload.get("demo"))),
                    json.dumps(payload, ensure_ascii=False), json.dumps(review, ensure_ascii=False) if review else None,
                    review.get("reviewedAt") if review else None,
                ),
            )
            self.db.commit()

    def set_review(self, case_id: str, review: dict) -> None:
        with self.lock:
            self.db.execute(
                "UPDATE cases SET review = ?, reviewed_at = ?, status = 'reviewed' WHERE id = ?",
                (json.dumps(review, ensure_ascii=False), review["reviewedAt"], case_id),
            )
            self.db.commit()

    def delete(self, case_id: str) -> bool:
        with self.lock:
            cur = self.db.execute("DELETE FROM cases WHERE id = ?", (case_id,))
            self.db.commit()
            return cur.rowcount > 0

    def all(self) -> list[sqlite3.Row]:
        with self.lock:
            return self.db.execute("SELECT * FROM cases").fetchall()

    # -- meta (hub public key)
    def get_meta(self, k: str) -> Optional[str]:
        with self.lock:
            row = self.db.execute("SELECT v FROM meta WHERE k = ?", (k,)).fetchone()
            return row["v"] if row else None

    def set_meta(self, k: str, v: str) -> None:
        with self.lock:
            self.db.execute("INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v", (k, v))
            self.db.commit()

    # -- audit (append-only; never personal data)
    def audit(self, actor: str, action: str, case_id: Optional[str] = None, detail: str = "") -> None:
        with self.lock:
            self.db.execute("INSERT INTO audit (at, actor, action, case_id, detail) VALUES (?,?,?,?,?)",
                            (iso(now()), (actor or "unknown")[:80], action, case_id, detail[:300]))
            self.db.commit()

    def audit_list(self, case_id: Optional[str], limit: int) -> list[dict]:
        with self.lock:
            if case_id:
                rows = self.db.execute("SELECT * FROM audit WHERE case_id = ? ORDER BY id DESC LIMIT ?", (case_id, limit)).fetchall()
            else:
                rows = self.db.execute("SELECT * FROM audit ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
        return [dict(r) for r in rows]

    # -- retention
    def purge_reviewed_before(self, cutoff: datetime) -> list[str]:
        with self.lock:
            ids = [r["id"] for r in self.db.execute(
                "SELECT id FROM cases WHERE status = 'reviewed' AND reviewed_at < ?", (iso(cutoff),)).fetchall()]
            self.db.executemany("DELETE FROM cases WHERE id = ?", [(i,) for i in ids])
            self.db.commit()
        return ids


store = Store(DB_PATH)


def purge_expired(force: bool = False) -> int:
    if not force and store.last_purge and now() - store.last_purge < timedelta(hours=1):
        return 0
    store.last_purge = now()
    ids = store.purge_reviewed_before(now() - timedelta(days=RETENTION_DAYS))
    for i in ids:
        store.audit("system", "retention_purge", i, f"reviewed more than {RETENTION_DAYS} days ago")
    return len(ids)


def seed_if_empty() -> int:
    if not SEED or store.count() or not SEED_FILE.exists():
        return 0
    seeds = json.loads(SEED_FILE.read_text(encoding="utf-8"))
    t0 = now()
    for s in seeds:
        received = t0 - timedelta(minutes=s.get("receivedMinutesAgo", 30))
        review = s.get("review")
        if review:
            review = {**review, "reviewedAt": iso(received + timedelta(minutes=review.pop("afterMinutes", 20)))}
        store.insert(s["case"], received, review)
    store.audit("system", "seeded", None, f"{len(seeds)} synthetic demo cases")
    return len(seeds)


# ---------------------------------------------------------------- models
class CaseIn(BaseModel):
    model_config = {"extra": "allow"}
    id: str = Field(min_length=8, max_length=64)
    createdAt: str
    lang: Literal["en", "hi", "ta", "te", "mr", "kn"]
    site: dict
    patient: dict
    consent: dict
    interview: dict
    measurements: dict = Field(default_factory=dict)
    profile: dict
    passport: dict = Field(default_factory=dict)
    operator: Optional[str] = None
    appVersion: Optional[str] = None
    demo: bool = False


class Reviewer(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    regNo: Optional[str] = Field(default=None, max_length=40)


class ReviewIn(BaseModel):
    reviewer: Reviewer
    decision: Literal["approve", "modify", "in_person", "urgent"]
    lensCategory: Optional[str] = None
    designEmphasis: Optional[Literal["Balanced", "Intermediate", "Near"]] = None
    addD: Optional[float] = Field(default=None, ge=0, le=4)
    nextStep: str = Field(default="", max_length=300)
    notes: str = Field(default="", max_length=2000)
    messageToPatient: str = Field(default="", max_length=600)


class HubKeyIn(BaseModel):
    jwk: dict


class SpeechIn(BaseModel):
    lang: Literal["en", "hi", "ta", "te", "mr", "kn"]
    text: str = Field(min_length=1, max_length=SARVAM_MAX_TEXT_CHARS)


# ---------------------------------------------------------------- helpers
IDENTITY_FIELDS = ("name", "phone", "village")


def row_summary(r: sqlite3.Row) -> dict[str, Any]:
    payload = json.loads(r["payload"])
    review = json.loads(r["review"]) if r["review"] else None
    received = datetime.fromisoformat(r["received_at"])
    due = received + timedelta(hours=SLA_HOURS.get(r["lane"], 72))
    prof = payload.get("profile", {})
    p = payload.get("patient", {}) or {}
    return {
        "id": r["id"],
        "createdAt": r["created_at"],
        "receivedAt": r["received_at"],
        "lane": r["lane"],
        "status": r["status"],
        "slaDueAt": iso(due),
        "overdue": r["status"] != "reviewed" and now() > due,
        "patient": {"name": p.get("name"), "age": p.get("age"), "sex": p.get("sex"), "pin": p.get("pin") or pin_of(p.get("village")),
                    "sealed": p.get("sealed")},
        "site": payload.get("site"),
        "lang": payload.get("lang"),
        "demo": bool(r["demo"]),
        "summary": prof.get("summary"),
        "dominance": prof.get("vision", {}).get("dominance"),
        "flags": [f.get("title") for f in prof.get("triage", {}).get("flags", [])],
        "review": {"decision": review["decision"], "decisionLabel": review.get("decisionLabel"), "reviewer": review["reviewer"]["name"]} if review else None,
    }


def full_case(r: sqlite3.Row) -> dict[str, Any]:
    payload = json.loads(r["payload"])
    payload["review"] = json.loads(r["review"]) if r["review"] else None
    payload["server"] = row_summary(r)
    return payload


def pin_of(text: Optional[str]) -> Optional[str]:
    if not text:
        return None
    return next((tok for tok in str(text).replace(",", " ").split() if tok.isdigit() and len(tok) == 6), None)


def require_token(token: Optional[str]) -> None:
    if PORTAL_TOKEN and token != PORTAL_TOKEN:
        raise HTTPException(401, "portal token required")


def actor_of(request: Request) -> str:
    return (request.headers.get("x-actor") or "anonymous")[:80]


# ---------------------------------------------------------------- app
@asynccontextmanager
async def lifespan(_app: FastAPI):
    seed_if_empty()
    purge_expired(force=True)
    yield


app = FastAPI(
    title="DivyaDrishti bridge",
    version=VERSION,
    description="Store-and-forward bridge between field phones and remote optometrists.",
    lifespan=lifespan,
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    h = response.headers
    h["Content-Security-Policy"] = CSP
    h["X-Content-Type-Options"] = "nosniff"
    h["Referrer-Policy"] = "no-referrer"
    h["Permissions-Policy"] = "camera=(self), microphone=(self), geolocation=(), payment=()"
    h["Strict-Transport-Security"] = "max-age=31536000"
    h["Cross-Origin-Opener-Policy"] = "same-origin"
    if request.url.path.startswith("/api/"):
        h["Cache-Control"] = "no-store"
    return response


@app.get("/api/health")
def health() -> dict:
    return {
        "ok": True, "version": VERSION, "cases": store.count(),
        "hubKey": bool(store.get_meta("hub_key")), "time": iso(now()),
        "voice": {
            "configured": bool(os.environ.get("SARVAM_API_KEY")),
            "ttsModel": SARVAM_TTS_MODEL,
            "sttModel": SARVAM_STT_MODEL,
        },
    }


async def sarvam_post(url: str, **kwargs) -> httpx.Response:
    api_key = os.environ.get("SARVAM_API_KEY")
    if not api_key:
        raise HTTPException(503, "Speech service is not configured on this server")
    headers = {"api-subscription-key": api_key}
    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.post(url, headers=headers, **kwargs)
    except httpx.TimeoutException as exc:
        logger.warning("Sarvam request timed out")
        raise HTTPException(504, "Speech service timed out") from exc
    except httpx.RequestError as exc:
        logger.warning("Sarvam request failed: %s", type(exc).__name__)
        raise HTTPException(502, "Speech service is temporarily unavailable") from exc
    if response.is_error:
        logger.warning("Sarvam returned HTTP %s", response.status_code)
        raise HTTPException(502, "Speech service rejected the request")
    return response


@app.post("/api/voice/speak")
async def voice_speak(body: SpeechIn) -> Response:
    if not body.text.strip():
        raise HTTPException(422, "Speech text cannot be blank")
    synthesis = {
        "text": body.text,
        "language_code": SARVAM_LANGUAGES[body.lang],
        "model": SARVAM_TTS_MODEL,
        "pace": 1.0,
        "speech_sample_rate": 24000,
    }
    speaker = os.environ.get("SARVAM_TTS_SPEAKER")
    if speaker:
        synthesis["speaker"] = speaker
    response = await sarvam_post(
        "https://api.sarvam.ai/text-to-speech",
        json=synthesis,
    )
    try:
        audio = base64.b64decode(response.json()["audios"][0], validate=True)
    except (ValueError, KeyError, IndexError, TypeError) as exc:
        logger.warning("Sarvam returned an invalid TTS payload")
        raise HTTPException(502, "Speech service returned invalid audio") from exc
    if not audio:
        raise HTTPException(502, "Speech service returned empty audio")
    return Response(content=audio, media_type="audio/wav")


@app.post("/api/voice/transcribe")
async def voice_transcribe(request: Request, lang: Literal["en", "hi", "ta", "te", "mr", "kn"] = Query(...)) -> dict:
    content_type = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    if content_type not in {"audio/wav", "audio/x-wav"}:
        raise HTTPException(415, "Expected mono WAV audio")
    audio = bytearray()
    async for chunk in request.stream():
        if len(audio) + len(chunk) > SARVAM_MAX_AUDIO_BYTES:
            raise HTTPException(413, "Audio recording is too large")
        audio.extend(chunk)
    if not audio:
        raise HTTPException(422, "Audio recording is empty")
    response = await sarvam_post(
        "https://api.sarvam.ai/speech-to-text",
        data={"model": SARVAM_STT_MODEL, "language_code": SARVAM_LANGUAGES[lang]},
        files={"file": ("recording.wav", bytes(audio), "audio/wav")},
    )
    try:
        result = response.json()
        transcript = result["transcript"]
        if not isinstance(transcript, str):
            raise TypeError("transcript must be text")
    except (ValueError, KeyError, TypeError) as exc:
        logger.warning("Sarvam returned an invalid STT payload")
        raise HTTPException(502, "Speech service returned an invalid transcript") from exc
    return {"transcript": transcript, "language_code": result.get("language_code"), "confidence": None}


# ---------------------------------------------------------------- hub key (end-to-end identity encryption)
@app.get("/api/hub/key")
def get_hub_key() -> dict:
    raw = store.get_meta("hub_key")
    if not raw:
        raise HTTPException(404, "no hub key set up yet")
    return json.loads(raw)


@app.put("/api/hub/key")
def put_hub_key(body: HubKeyIn, request: Request, replace: bool = Query(False), x_portal_token: Optional[str] = Header(None)) -> dict:
    require_token(x_portal_token)
    jwk = body.jwk
    if "d" in jwk:
        raise HTTPException(422, "that is a private key: never upload it")
    if jwk.get("kty") != "EC" or jwk.get("crv") != "P-256" or not jwk.get("x") or not jwk.get("y"):
        raise HTTPException(422, "expected an EC P-256 public key (JWK)")
    public = {"kty": "EC", "crv": "P-256", "x": jwk["x"], "y": jwk["y"]}
    kid = jwk_thumbprint(public)
    existing = store.get_meta("hub_key")
    if existing and json.loads(existing)["kid"] != kid and not replace:
        raise HTTPException(409, "a different hub key is already set; replacing it makes older sealed identities unreadable without the old key")
    record = {"kid": kid, "jwk": public, "createdAt": iso(now())}
    store.set_meta("hub_key", json.dumps(record))
    store.audit(actor_of(request), "hub_key_set", None, f"kid {kid}")
    return record


# ---------------------------------------------------------------- cases
@app.post("/api/cases", status_code=201)
async def create_case(request: Request) -> JSONResponse:
    body = await request.body()
    if len(body) > MAX_CASE_BYTES:
        raise HTTPException(413, "case too large")
    try:
        case = CaseIn.model_validate_json(body)
    except Exception as e:  # pydantic validation error
        raise HTTPException(422, f"invalid case: {e}") from e
    if not case.consent.get("given"):
        raise HTTPException(422, "no recorded consent: case not stored")
    lane = (case.profile.get("triage") or {}).get("lane")
    if lane not in SLA_HOURS:
        raise HTTPException(422, "profile.triage.lane must be red, amber or green")
    actor = actor_of(request)
    if store.get(case.id):  # idempotent retry from a phone on a flaky network
        store.audit(actor, "case_duplicate", case.id)
        return JSONResponse({"id": case.id, "status": "duplicate"}, status_code=200)
    data = case.model_dump()
    patient = dict(data.get("patient") or {})
    # Defence in depth: a real case must not carry identity in clear text.
    if not case.demo and any(patient.get(k) for k in IDENTITY_FIELDS):
        patient["pin"] = patient.get("pin") or pin_of(patient.get("village"))
        for k in IDENTITY_FIELDS:
            patient.pop(k, None)
        store.audit(actor, "identity_stripped", case.id, "plaintext name/phone/village removed on arrival")
    data["patient"] = patient
    store.insert(data, now())
    store.audit(actor, "case_received", case.id, f"lane {lane}; identity {'sealed' if patient.get('sealed') else 'not sent'}")
    return JSONResponse({"id": case.id, "status": "stored", "lane": lane, "slaHours": SLA_HOURS[lane]}, status_code=201)


@app.get("/api/cases")
def list_cases(
    lane: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    q: Optional[str] = Query(None, max_length=80),
) -> list[dict]:
    purge_expired()
    rows = [row_summary(r) for r in store.all()]
    if lane:
        rows = [r for r in rows if r["lane"] == lane]
    if status:
        rows = [r for r in rows if r["status"] == status]
    if q:
        ql = q.lower()
        rows = [r for r in rows if ql in json.dumps(r, ensure_ascii=False).lower()]
    # open cases first, by lane then by deadline; reviewed cases last
    rows.sort(key=lambda r: (r["status"] == "reviewed", LANE_ORDER.get(r["lane"], 9), r["slaDueAt"]))
    return rows


@app.get("/api/cases/{case_id}")
def get_case(case_id: str, request: Request) -> dict:
    r = store.get(case_id)
    if not r:
        raise HTTPException(404, "case not found")
    store.audit(actor_of(request), "case_viewed", case_id)
    return full_case(r)


@app.post("/api/cases/{case_id}/review")
def review_case(case_id: str, review: ReviewIn, request: Request, x_portal_token: Optional[str] = Header(None)) -> dict:
    require_token(x_portal_token)
    r = store.get(case_id)
    if not r:
        raise HTTPException(404, "case not found")
    rv = review.model_dump()
    rv["decisionLabel"] = DECISIONS[review.decision]
    rv["reviewedAt"] = iso(now())
    store.set_review(case_id, rv)
    store.audit(f"{review.reviewer.name} ({review.reviewer.regNo or 'no reg. no.'})", "case_reviewed", case_id, rv["decisionLabel"])
    return {"id": case_id, "status": "reviewed", "review": rv}


@app.delete("/api/cases/{case_id}")
def delete_case(case_id: str, request: Request, x_portal_token: Optional[str] = Header(None)) -> dict:
    """Erasure on the patient's request (DPDP Act 2023, right to erasure)."""
    require_token(x_portal_token)
    if not store.delete(case_id):
        raise HTTPException(404, "case not found")
    store.audit(actor_of(request), "case_erased", case_id, "erased on request")
    return {"id": case_id, "status": "deleted"}


@app.get("/api/cases/{case_id}/fhir")
def case_fhir(case_id: str, request: Request) -> JSONResponse:
    r = store.get(case_id)
    if not r:
        raise HTTPException(404, "case not found")
    store.audit(actor_of(request), "fhir_exported", case_id)
    return JSONResponse(case_to_bundle(full_case(r)), media_type="application/fhir+json")


@app.get("/api/audit")
def audit(case_id: Optional[str] = Query(None, max_length=64), limit: int = Query(100, ge=1, le=1000)) -> list[dict]:
    return store.audit_list(case_id, limit)


@app.get("/api/stats")
def stats() -> dict:
    """Pooled, de-identified counts for planning camps and specialist visits."""
    cases = [full_case(r) for r in store.all()]
    by_lane = {k: 0 for k in SLA_HOURS}
    flags: dict[str, int] = {}
    recs: dict[str, int] = {}
    dominance: dict[str, int] = {}
    places: dict[str, dict[str, int]] = {}
    langs: dict[str, int] = {}
    asked, review_mins = [], []
    for c in cases:
        prof = c.get("profile", {})
        lane = prof.get("triage", {}).get("lane", "green")
        by_lane[lane] = by_lane.get(lane, 0) + 1
        for f in prof.get("triage", {}).get("flags", []):
            flags[f["title"]] = flags.get(f["title"], 0) + 1
        rc = prof.get("recommendation", {}).get("category")
        if rc:
            recs[rc] = recs.get(rc, 0) + 1
        dm = prof.get("vision", {}).get("dominance")
        if dm:
            dominance[dm] = dominance.get(dm, 0) + 1
        langs[c.get("lang", "?")] = langs.get(c.get("lang", "?"), 0) + 1
        pin = c["server"]["patient"].get("pin") or "unknown"
        pl = places.setdefault(pin, {"cases": 0, "amber": 0, "red": 0})
        pl["cases"] += 1
        if lane in ("amber", "red"):
            pl[lane] += 1
        if c.get("interview", {}).get("asked"):
            asked.append(c["interview"]["asked"])
        rv = c.get("review")
        if rv and rv.get("reviewedAt"):
            rec = datetime.fromisoformat(c["server"]["receivedAt"])
            review_mins.append((datetime.fromisoformat(rv["reviewedAt"]) - rec).total_seconds() / 60)
    return {
        "cases": len(cases),
        "byLane": by_lane,
        "reviewed": sum(1 for c in cases if c.get("review")),
        "overdue": sum(1 for c in cases if c["server"]["overdue"]),
        "topFlags": sorted(flags.items(), key=lambda x: -x[1])[:8],
        "recommendations": recs,
        "dominance": dominance,
        "byPlace": places,
        "byLanguage": langs,
        "medianQuestionsAsked": median(asked) if asked else None,
        "medianReviewMinutes": round(median(review_mins)) if review_mins else None,
        "retentionDays": RETENTION_DAYS,
    }


# static web apps (field app at /, portal at /portal.html); mounted last
app.mount("/", StaticFiles(directory=str(WEB), html=True), name="web")
