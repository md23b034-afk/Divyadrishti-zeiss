"""API tests for the bridge server. Run from the repo root: python -m pytest tests/server"""
import copy
import json
import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
os.environ["DD_DB"] = str(Path(tempfile.mkdtemp()) / "test.db")
os.environ["DD_SEED"] = "0"
sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient  # noqa: E402

from server.app import app  # noqa: E402

SEEDS = json.loads((ROOT / "server" / "seed_cases.json").read_text(encoding="utf-8"))
BY_NAME = {s["case"]["patient"]["name"]: s["case"] for s in SEEDS}
client = TestClient(app)


def case(name: str, **override) -> dict:
    c = copy.deepcopy(BY_NAME[name])
    c.update(override)
    return c


def test_health_and_static():
    assert client.get("/api/health").json()["ok"] is True
    assert "DivyaDrishti" in client.get("/").text
    assert client.get("/portal.html").status_code == 200


def test_speech_routes_proxy_without_exposing_credentials(monkeypatch):
    import base64
    import server.app as server_app

    calls = []

    class MockResponse:
        status_code = 200
        is_error = False

        def __init__(self, payload):
            self.payload = payload

        def json(self):
            return self.payload

    class MockAsyncClient:
        def __init__(self, timeout):
            assert timeout == 45.0

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return None

        async def post(self, url, headers, **kwargs):
            calls.append((url, headers, kwargs))
            if url.endswith("/text-to-speech"):
                return MockResponse({"audios": [base64.b64encode(b"RIFF-test-audio").decode()]})
            return MockResponse({"transcript": "நன்றாக", "language_code": "ta-IN"})

    monkeypatch.setenv("SARVAM_API_KEY", "server-only-test-key")
    monkeypatch.setattr(server_app.httpx, "AsyncClient", MockAsyncClient)

    tts = client.post("/api/voice/speak", json={"lang": "ta", "text": "வணக்கம்"})
    assert tts.status_code == 200
    assert tts.headers["content-type"] == "audio/wav"
    assert tts.content == b"RIFF-test-audio"
    tts_url, tts_headers, tts_kwargs = calls[0]
    assert tts_url.endswith("/text-to-speech")
    assert tts_headers["api-subscription-key"] == "server-only-test-key"
    assert tts_kwargs["json"]["language_code"] == "ta-IN"
    assert tts_kwargs["json"]["model"] == "bulbul:v3"
    assert "speaker" not in tts_kwargs["json"]

    stt = client.post(
        "/api/voice/transcribe?lang=ta",
        content=b"RIFF-mono-wav",
        headers={"Content-Type": "audio/wav"},
    )
    assert stt.status_code == 200
    assert stt.json()["transcript"] == "நன்றாக"
    stt_url, stt_headers, stt_kwargs = calls[1]
    assert stt_url.endswith("/speech-to-text")
    assert stt_headers["api-subscription-key"] == "server-only-test-key"
    assert stt_kwargs["data"] == {"model": "saaras:v4", "language_code": "ta-IN"}
    assert stt_kwargs["files"]["file"][0] == "recording.wav"
    assert "server-only-test-key" not in tts.text
    assert "server-only-test-key" not in stt.text


def test_speech_routes_reject_invalid_or_unconfigured_requests(monkeypatch):
    monkeypatch.delenv("SARVAM_API_KEY", raising=False)
    assert client.post("/api/voice/speak", json={"lang": "ta", "text": "வணக்கம்"}).status_code == 503
    assert client.post("/api/voice/speak", json={"lang": "xx", "text": "hello"}).status_code == 422
    assert client.post("/api/voice/speak", json={"lang": "en", "text": " "}).status_code == 422
    assert client.post(
        "/api/voice/transcribe?lang=ta",
        content=b"recording",
        headers={"Content-Type": "audio/webm"},
    ).status_code == 415


def test_create_is_idempotent():
    c = case("S. Kumar")
    r1 = client.post("/api/cases", json=c)
    assert r1.status_code == 201 and r1.json()["lane"] == "green"
    r2 = client.post("/api/cases", json=c)
    assert r2.status_code == 200 and r2.json()["status"] == "duplicate"


def test_rejects_missing_consent_and_bad_lane():
    c = case("R. Lakshmi", id="no-consent-0001")
    c["consent"] = {"given": False}
    assert client.post("/api/cases", json=c).status_code == 422
    c = case("R. Lakshmi", id="bad-lane-00001")
    c["profile"]["triage"]["lane"] = "purple"
    assert client.post("/api/cases", json=c).status_code == 422


def test_queue_puts_red_first_and_has_sla():
    for name in ("K. Murugan", "M. Ravi", "V. Arjun"):
        client.post("/api/cases", json=case(name))
    rows = client.get("/api/cases").json()
    open_rows = [r for r in rows if r["status"] != "reviewed"]
    assert open_rows[0]["lane"] == "red"
    assert all("slaDueAt" in r for r in rows)
    assert {r["lane"] for r in client.get("/api/cases?lane=amber").json()} == {"amber"}


def test_review_round_trip_and_fhir():
    c = case("R. Lakshmi")
    client.post("/api/cases", json=c)
    review = {
        "reviewer": {"name": "Optom. Test", "regNo": "T-1"},
        "decision": "in_person",
        "lensCategory": "readers",
        "addD": 1.75,
        "nextStep": "Retina photo at Saturday camp",
        "messageToPatient": "Please come to the camp on Saturday.",
    }
    r = client.post(f"/api/cases/{c['id']}/review", json=review)
    assert r.status_code == 200
    full = client.get(f"/api/cases/{c['id']}").json()
    assert full["review"]["decisionLabel"] == "In-person examination"
    assert full["server"]["status"] == "reviewed"
    bundle = client.get(f"/api/cases/{c['id']}/fhir").json()
    types = [e["resource"]["resourceType"] for e in bundle["entry"]]
    for t in ("Patient", "QuestionnaireResponse", "Observation", "Flag", "ServiceRequest", "Practitioner", "ClinicalImpression"):
        assert t in types, t
    qr = next(e["resource"] for e in bundle["entry"] if e["resource"]["resourceType"] == "QuestionnaireResponse")
    assert any("[ta]" in x.get("valueString", "") for i in qr["item"] for x in i.get("extension", []))


def test_review_validation():
    c = case("P. Selvi")
    client.post("/api/cases", json=c)
    bad = {"reviewer": {"name": "X"}, "decision": "approve"}
    assert client.post(f"/api/cases/{c['id']}/review", json=bad).status_code == 422
    assert client.post("/api/cases/does-not-exist/review", json={"reviewer": {"name": "Optom"}, "decision": "approve"}).status_code == 404


def test_vision_prescription_in_fhir():
    c = case("V. Arjun")
    client.post("/api/cases", json=c)
    bundle = client.get(f"/api/cases/{c['id']}/fhir").json()
    vp = [e["resource"] for e in bundle["entry"] if e["resource"]["resourceType"] == "VisionPrescription"]
    assert vp and {s["eye"] for s in vp[0]["lensSpecification"]} == {"right", "left"}


def test_erasure_and_stats():
    c = case("A. Fatima")
    client.post("/api/cases", json=c)
    s = client.get("/api/stats").json()
    assert s["cases"] >= 1 and set(s["byLane"]) == {"red", "amber", "green"}
    assert client.delete(f"/api/cases/{c['id']}").status_code == 200
    assert client.get(f"/api/cases/{c['id']}").status_code == 404
