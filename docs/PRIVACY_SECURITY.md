# Reliability, interpretability, privacy and security

What the prototype does today, how, and what is still open. Every item below is implemented and covered by a test unless marked *planned*.

## Privacy and encryption

| Layer | What | How | Test |
|---|---|---|---|
| **Consent** | No case is stored without recorded consent (time, language, text version) | Server rejects cases without it (422) | `tests/server/test_api.py` |
| **On the phone** | Every case and the in-progress draft are encrypted at rest | AES-256-GCM. The data key is random and stored only wrapped by a key derived from the operator's 6-digit PIN (PBKDF2-SHA-256, 310,000 iterations). Each record is bound to its case id (GCM additional data). A wrong PIN fails authentication. Five wrong PINs trigger an escalating wait. Auto-lock after 15 minutes idle. | `tests/engine/crypto.test.mjs` |
| **Speech processing** | With consent, short microphone recordings are sent to Sarvam AI for transcription; the bridge does not persist the audio | Browser records and converts to mono 16 kHz WAV; FastAPI forwards it to Saaras v4 in the selected language. Bulbul v3 generates question audio. `SARVAM_API_KEY` stays in the server environment. Vendor processing is subject to Sarvam's terms and retention policy. | `tests/server/test_api.py` |
| **Camera images** | Never leave the phone | The face model runs on the device (MediaPipe); only measurements are stored | by design |
| **Identity in transit and on the server** | The server stores **no name, phone or village**: only age, sex, PIN code and the clinical record under a pseudonymous case id | The phone seals `{name, phone, village}` to the optometrist hub's public key: ECDH P-256, fresh ephemeral key per case, HKDF-SHA-256, AES-256-GCM, bound to the case id. Only the hub's browser holds the private key (non-extractable, plus one recovery file). Without a hub key, identity simply stays on the phone, and the phone sends the WhatsApp reply itself. | `crypto.test.mjs`, `test_privacy.py` |
| **Defence in depth** | A non-demo case that arrives with a plaintext name or phone is stripped on arrival and the event is logged | Server-side check | `test_privacy.py` |
| **Access log** | Every receipt, view, review, FHIR export, erasure and hub-key change is appended to an audit log, with no personal data in it | SQLite `audit` table, shown per case in the portal | `test_privacy.py` |
| **Erasure** | Right to erasure (DPDP Act 2023) | `DELETE /api/cases/{id}`; logged | `test_api.py` |
| **Retention** | Reviewed cases are purged after `DD_RETENTION_DAYS` (default 180) | Hourly check plus at start-up; logged | `test_privacy.py` |
| **Transport and browser** | HTTPS in deployment; strict headers on every response | CSP (scripts only from self + the MediaPipe CDN; no inline script; no framing), HSTS, `nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` (camera and microphone: self only), `Cache-Control: no-store` on the API | `test_privacy.py`; the e2e test runs under the CSP |
| **Residency** | Data stays in India | Deploy to `asia-south1` (Mumbai) | deployment |
| **Portal access** | Review, erase and hub-key changes need a token when `DD_PORTAL_TOKEN` is set; the token is entered via a URL fragment and kept in the browser | — | — |

**Honest limits.** A 6-digit PIN can be brute-forced offline in hours on a GPU if someone copies the phone's browser storage; production should use a native wrapper with the Android Keystore. The portal token is a shared secret, not per-user login (*planned*: ABDM Health Professional Registry or ZEISS ID sign-in). The audit log is append-only by convention, not cryptographically chained (*planned*).

## Reliability

- **Encrypted autosave.** The case in progress is saved after every answer and measurement. A reload, crash or phone call loses nothing (*Continue unfinished patient*). Tested in the e2e test by reloading mid-interview.
- **Store-and-forward.** Cases queue on the phone and retry every minute and whenever the network returns. The upload is idempotent on the case id, so retries never duplicate. The browser is asked to keep the storage from eviction.
- **Speech recognition.** Saaras v4 returns a transcript without a confidence score in this integration; red-flag "yes" answers and contradictory multi-select answers always need confirmation by tap. Answers can always be corrected or entered by tapping.
- **Measurement quality gates.** PD capture is refused while the head is tilted (more than 4°) or turned (more than 12% left/right asymmetry). Reading distance needs a stable median before it can be used. Every measurement records whether the phone was calibrated.
- **Phone check.** A pre-flight screen covers HTTPS, microphone recording, Sarvam service configuration, calibration, storage persistence, encryption, server reachability, the hub key and battery, with live voice, microphone and camera tests.
- **Offline shell.** A service worker caches the app (including the language packs) so it opens with no signal.

## Interpretability

- **Why each question was asked.** Every question carries a stated reason, shown to the operator and logged in the trace beside the patient's own words.
- **Decision path.** Every lens rule checked, in order, with the values it saw: "✗ Mostly close work (near 18%, arm's length 64%…) → ✓ Arm's-length work dominates".
- **Data quality.** For each profile: how many daily-hour inputs were reported versus assumed, whether the working distance was measured (and with a calibrated camera), whether the near point was measured, whether the eye chart was size-calibrated, PD method and head pose, voice versus tap answers, and any simulated demo values. Summarised as high, medium or low.
- **Rules version.** Every case records the rule-set version (`2026.11-r2`) that produced it, so a decision can be reproduced after the rules change.
- **Evidence.** Each clinical rule is listed with its source in `CLINICAL_LOGIC.md`.
