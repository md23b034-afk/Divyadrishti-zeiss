# DivyaDrishti

**A voice-first, adaptive eye-care interview that turns the phone a small optical store or eye-camp volunteer already owns into the front door to a remote optometrist.**

ZEISS Hackathon 2026 · Theme 3: No-Device Vision Intelligence & Accessible Clinical UX
Team: Ridhima · Kedar · Venkatesh · Rohit (IIT Madras)

---

## What it does

1. **Adaptive voice anamnesis in six languages:** English, Hindi, Tamil, Telugu, Marathi and Kannada. The patient talks; the phone parses the answer, including native number words and fractions (ढाई, अडीच, ಎರಡೂವರೆ…), code-mixed speech ("sugar irukku", "BP undi") and dictated prescriptions. It asks only what can change the outcome for *this* patient, and says why it is asking. A red flag (sudden vision loss, painful red eye, white pupil in a child) switches to urgent mode immediately. Ambiguous and critical answers are confirmed by tap.
2. **Ask, then measure.** ZEISS's own SmartLife Individual 3 research found self-reported viewing behaviour differs markedly from objective measurement, so the phone camera measures what questionnaires guess:
   - habitual reading distance and near point (iris as a ruler, MediaPipe on the device),
   - pupillary distance and fitting height (centration; refused while the head is tilted or turned),
   - tumbling-E distance acuity with a paper-pinhole retest, and an Amsler grid.
3. **Functional Vision Profile.** Hours at near, arm's length and distance, mapped to the **Balanced / Intermediate / Near** design options that ZEISS individual progressive lenses already take. It adds an estimated reading add (Hofstetter amplitude at the *measured* working distance), child myopia risk, a triage lane and a lens category. A **decision path** shows each rule checked, **data quality** says what was measured versus assumed, and each case records its **rules version**.
4. **Remote Optometrist Bridge.** Cases are stored encrypted on the phone and sent when signal returns. Optometrists review them by lane against response-time targets (red 2 h, amber 24 h, green 72 h), sign off or redirect, and the reply goes back to the patient as a **Vision Passport** in their language. Every case exports as a FHIR R4 bundle.
5. **Private by design.** Data on the phone is encrypted (AES-256-GCM, PIN-protected). The server never sees names or phone numbers: they are sealed to the optometrist hub's key (ECDH P-256), and only the hub's browser can open them. Every access is logged, reviewed cases expire, and strict security headers apply. See `docs/PRIVACY_SECURITY.md`.

## Run it

```bash
# server + both web apps (Python 3.12)
# macOS/Linux
python -m venv .venv && .venv/bin/python -m pip install -r server/requirements.txt -r server/requirements-dev.txt
export SARVAM_API_KEY=your_server_side_key
# Windows PowerShell: use .venv\Scripts\python.exe -m pip install -r server\requirements.txt -r server\requirements-dev.txt
# then set the key with: $env:SARVAM_API_KEY="your_server_side_key"
uvicorn server.app:app --reload --port 8000
# or, for a phone demo on the same Wi-Fi:  powershell -ExecutionPolicy Bypass -File tools\run_demo.ps1
```

- Speech uses Sarvam Bulbul v3 (TTS; Shubh voice by default) and Saaras v4 (STT).
  Set `SARVAM_TTS_SPEAKER` on the server to choose another supported persona.
  The key is read only by
  FastAPI from `SARVAM_API_KEY`; never put it in frontend code. Audio is recorded
  after consent, sent to FastAPI as short WAV clips, and forwarded to Sarvam for
  transcription. If the service is not configured or available, browser speech
  synthesis may be used for playback and patients can answer by tapping.
- Field app (phone): <http://localhost:8000/>. Set a PIN, then try a **demo patient** (11 synthetic patients across six languages) to watch the full adaptive flow without a microphone. **Phone check** verifies speech-service configuration, microphone, camera and calibration.
- Optometrist portal: <http://localhost:8000/portal.html>. Click *Set up identity encryption* first.
- API docs: <http://localhost:8000/docs>

**Phone demo:** voice and camera need HTTPS. See `docs/PHONE_DEMO_SETUP.md` (quick tunnel, Cloud Run, or the same-Wi-Fi Chrome flag) and the phone's voice-data setup.

## Tests

```bash
npm test                                      # 63 engine tests: 6-language parsing, Rx, adaptive paths, profile,
                                              #   optics, crypto (PIN vault, hub sealing), decision path, data quality
.venv/Scripts/python -m pytest tests/server   # 15 API tests: idempotency, consent, queue, review, FHIR, erasure,
                                              #   identity stripping, hub key, audit log, headers, retention
BASE=http://127.0.0.1:8000 python tests/e2e/smoke.py   # real browser: hub key -> PIN -> interview -> reload/resume
                                                      #   -> checks -> sealed send -> review -> access log -> reply
npm run seed                                  # rebuild server/seed_cases.json from the personas
```

## Layout

| Path | What |
|---|---|
| `web/js/engine/` | Pure, tested clinical core: `questions.js` (30-question bank with eligibility rules and reasons), `adaptive.js` (engine), `profile.js` (vision profile, triage, lens, decision path, data quality), `parse.js` (answers in six languages), `rx.js` (spoken prescriptions) |
| `web/js/lang/` | One pack per added language (`te.js`, `mr.js`, `kn.js`): UI, questions, answer keywords, passport, reply templates. A native reviewer checks one file. |
| `web/js/measure/` | `geometry.js` (iris distance, PD with convergence correction, head-pose gate, Prentice, optotype sizes), `acuity.js` (tumbling-E staircase), `face.js` (MediaPipe) |
| `web/js/crypto.js` | WebCrypto: PIN vault, AES-256-GCM, identity sealing to the hub |
| `web/js/app.js` | Field app (offline-first PWA, encrypted IndexedDB queue, autosave, phone check) |
| `web/js/portal.js` | Optometrist Bridge portal, hub keys, access log, camp-planning view |
| `server/` | FastAPI + SQLite bridge, FHIR R4 export, audit log, retention, security headers |
| `docs/` | `CLINICAL_LOGIC.md`, `PRIVACY_SECURITY.md`, `BRIDGE.md`, `PHONE_DEMO_SETUP.md`, `DEMO_SCRIPT.md` |

## Honest status

- Clinical rules are **proposed** and must be reviewed by optometrists before any patient use. Nothing here diagnoses; the optometrist confirms every power.
- Camera measurements are implemented and their geometry is unit-tested, but they are **not yet validated against a pupillometer, autorefractor or ruler on real faces**. That is the first pilot task (`docs/BRIDGE.md`).
- All Hindi, Tamil, Telugu, Marathi and Kannada text was drafted by the team and needs native-speaker review at the pilot sites.
- All patients in the repo are synthetic.
