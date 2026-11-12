"""Privacy and security behaviour of the bridge server."""
import copy
import json
import os
import sys
import tempfile
from datetime import timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
os.environ.setdefault("DD_DB", str(Path(tempfile.mkdtemp()) / "test.db"))
os.environ.setdefault("DD_SEED", "0")
sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient  # noqa: E402

from server import app as server  # noqa: E402

client = TestClient(server.app)
SEEDS = json.loads((ROOT / "server" / "seed_cases.json").read_text(encoding="utf-8"))
BY_NAME = {s["case"]["patient"]["name"]: s["case"] for s in SEEDS}
JWK = {"kty": "EC", "crv": "P-256", "x": "f83OJ3D2xF1Bg8vub9tLe1gHMzV76e8Tus9uPHvRVEU", "y": "x_FEzRu9m36HLN_tue659LNpXW6pCyStikYjKIWI5a0"}


def real_case(name: str, new_id: str) -> dict:
    c = copy.deepcopy(BY_NAME[name])
    c["id"] = new_id
    c["demo"] = False
    return c


def test_plaintext_identity_is_stripped_from_real_cases():
    c = real_case("R. Lakshmi", "privacy-real-0001")
    r = client.post("/api/cases", json=c, headers={"X-Actor": "field:test"})
    assert r.status_code == 201
    stored = client.get(f"/api/cases/{c['id']}").json()
    assert "name" not in stored["patient"] and "phone" not in stored["patient"]
    assert stored["patient"]["pin"] == "631501"
    actions = [a["action"] for a in client.get(f"/api/audit?case_id={c['id']}").json()]
    assert "identity_stripped" in actions and "case_received" in actions


def test_sealed_identity_is_kept_opaque():
    c = real_case("S. Kumar", "privacy-sealed-01")
    c["patient"] = {"age": 54, "sex": "male", "pin": "600042",
                    "sealed": {"alg": "ECDH-ES+HKDF-SHA256+A256GCM", "kid": "k", "epk": {}, "iv": "aa", "ct": "bb"}}
    assert client.post("/api/cases", json=c).status_code == 201
    row = next(x for x in client.get("/api/cases").json() if x["id"] == c["id"])
    assert row["patient"]["sealed"]["ct"] == "bb" and row["patient"]["name"] is None
    bundle = client.get(f"/api/cases/{c['id']}/fhir").json()
    patient = next(e["resource"] for e in bundle["entry"] if e["resource"]["resourceType"] == "Patient")
    assert patient["name"][0]["text"].startswith("Pseudonymised") and "telecom" not in patient


def test_hub_key_rules_and_thumbprint_matches_browser():
    assert client.put("/api/hub/key", json={"jwk": {**JWK, "d": "secret"}}).status_code == 422
    assert client.put("/api/hub/key", json={"jwk": {"kty": "RSA"}}).status_code == 422
    r = client.put("/api/hub/key", json={"jwk": JWK})
    assert r.status_code == 200
    assert r.json()["kid"] == "oKIywvGUpTVTyxMQ3bwIIeQUudfr_CkLMjCE19ECD-U"  # computed by web/js/crypto.js
    assert client.get("/api/hub/key").json()["jwk"] == JWK
    other = {**JWK, "x": JWK["y"], "y": JWK["x"]}
    assert client.put("/api/hub/key", json={"jwk": other}).status_code == 409
    assert client.put("/api/hub/key?replace=true", json={"jwk": JWK}).status_code == 200


def test_audit_trail_for_view_review_export_erase():
    c = real_case("P. Selvi", "privacy-audit-001")
    client.post("/api/cases", json=c)
    client.get(f"/api/cases/{c['id']}", headers={"X-Actor": "portal:Optom. Test"})
    client.post(f"/api/cases/{c['id']}/review", json={"reviewer": {"name": "Optom. Test", "regNo": "T-9"}, "decision": "approve"})
    client.get(f"/api/cases/{c['id']}/fhir")
    client.delete(f"/api/cases/{c['id']}")
    actions = [a["action"] for a in client.get(f"/api/audit?case_id={c['id']}").json()]
    for a in ("case_received", "case_viewed", "case_reviewed", "fhir_exported", "case_erased"):
        assert a in actions, a
    log = json.dumps(client.get(f"/api/audit?case_id={c['id']}").json())
    assert "Selvi" not in log, "the audit log never holds patient names"


def test_security_headers():
    r = client.get("/api/health")
    assert "frame-ancestors 'none'" in r.headers["content-security-policy"]
    assert r.headers["cache-control"] == "no-store"
    assert r.headers["x-content-type-options"] == "nosniff"
    assert "camera=(self)" in r.headers["permissions-policy"]
    assert client.get("/").headers.get("cache-control") != "no-store"


def test_retention_purges_old_reviewed_cases():
    c = real_case("V. Arjun", "privacy-retain-01")
    client.post("/api/cases", json=c)
    client.post(f"/api/cases/{c['id']}/review", json={"reviewer": {"name": "Optom. Test"}, "decision": "approve"})
    old = server.iso(server.now() - timedelta(days=server.RETENTION_DAYS + 1))
    with server.store.lock:
        server.store.db.execute("UPDATE cases SET reviewed_at = ? WHERE id = ?", (old, c["id"]))
        server.store.db.commit()
    assert server.purge_expired(force=True) >= 1
    assert client.get(f"/api/cases/{c['id']}").status_code == 404
    assert any(a["action"] == "retention_purge" for a in client.get(f"/api/audit?case_id={c['id']}").json())


def test_new_languages_accepted():
    for lang in ("te", "mr", "kn"):
        c = real_case("S. Kumar", f"privacy-lang-{lang}")
        c["lang"] = lang
        assert client.post("/api/cases", json=c).status_code == 201
