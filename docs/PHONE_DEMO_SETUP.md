# Phone demo: setup checklist

Allow 30 minutes the day before and 10 minutes before the demo. Use an **Android phone with Chrome**. The app records microphone audio in the browser and sends it through FastAPI to Sarvam; use the tap controls if the service or microphone is unavailable.

## 1. Give the phone an HTTPS address (required)

The microphone and camera only work on `https://` (or `localhost`). Pick one.

| Option | When | Steps |
|---|---|---|
| **A. Quick tunnel** (recommended for tomorrow) | Laptop stays on and online during the demo | 1. Install once: `winget install --id Cloudflare.cloudflared`  2. Start the server: `powershell -ExecutionPolicy Bypass -File tools\run_demo.ps1`  3. In a second terminal: `cloudflared tunnel --url http://localhost:8000`  4. Open the `https://….trycloudflare.com` address it prints, on the phone. No account needed; the address changes each run. |
| **B. Cloud Run** (stable link, laptop can be off) | Judges should open it themselves | Store the Sarvam key in Secret Manager as `sarvam-api-key`, then deploy with `gcloud run deploy divyadrishti --source . --region asia-south1 --allow-unauthenticated --max-instances 1 --set-env-vars DD_PORTAL_TOKEN=<choose-a-secret> --set-secrets SARVAM_API_KEY=sarvam-api-key:latest`. Then open the portal once as `https://<url>/portal.html#token=<secret>`. The demo database lives in the instance and resets when it restarts. |
| **C. Same Wi-Fi, no install** (fallback) | No internet at the venue | 1. Run `tools\run_demo.ps1` (it prints the laptop's Wi-Fi address). 2. Allow Python through the Windows firewall when asked. 3. On the phone, open `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, add `http://<laptop-ip>:8000`, set it to *Enabled*, relaunch Chrome. |

For the tunnel and same-Wi-Fi options, set `SARVAM_API_KEY` in the shell before starting the server; do not put it in frontend files or commit it.

## 2. On the phone (once)

1. **Chrome up to date** (Play Store › Chrome › Update).
2. No native language packs are needed for Sarvam speech. Optional: install device text-to-speech voices for playback fallback if the server is unavailable.
3. Open the demo address in Chrome, then ⋮ › **Add to Home screen**. This installs the app and makes Chrome keep its storage.
4. First launch: **set a 6-digit PIN**. Use one the whole team knows for the demo; it encrypts the patient data on the phone.
5. **Allow the microphone and camera** when asked. If you dismissed the prompt: tap the lock icon in the address bar › Permissions.
6. Home › **Calibrate this phone**:
   - Screen size: hold any ID or bank card against the screen and drag the slider until the box matches the card's width.
   - Camera: hold the phone exactly **40 cm** from your eyes (measure it with a tape or a 40 cm string) and tap *Save*.
7. Home › **Phone check**. Confirm Sarvam is configured; "Storage protected" can stay grey. Tap 🔊 for each language, run *Test microphone* (say "fifty four") and *Test camera* (it should show "face ✓" and a distance in cm).
8. Battery saver **off**, screen timeout **10 min**, volume **up**, Do Not Disturb **on**.

## 3. On the laptop (portal)

1. Open `…/portal.html` (on the tunnel or Cloud Run address, or `localhost:8000`).
2. Click **Set up identity encryption**. A recovery file downloads; keep it, because it is the only way to read sealed names on another device. From now on, names and phone numbers from the phone are sealed so only this browser can read them.
3. Set your reviewer name (top-right chip).

## 4. Physical kit for the checks

- A **2 m** string or tape for the distance eye chart.
- A **40 cm** string for camera calibration.
- An **ID card** (Aadhaar or bank card) for screen calibration and PD scale.
- A **pin and a visiting card** for the pinhole test.
- A **PD ruler**, if you can borrow one from a store, to compare the camera PD live.
- Good, even light on the face. No window behind the person.

## 5. Running the demo

- **Quiet room? Live voice.** Pick the language, then New patient. A teammate answers in Tamil, Telugu, Hindi, Kannada or Marathi.
- **Noisy room? Demo patients.** The home screen has 11 synthetic patients across all six languages. They play the full interview with no microphone.
- Show one **red-flag patient** (M. Ravi): the interview stops after 7 questions.
- On the laptop: open the case, point out the **decision path**, **data quality**, the trace with the patient's own words, the **🔐 identity line** and the **access log**. Then sign it off and show the reply arriving in the phone's inbox.

## If something fails

| Symptom | Fix |
|---|---|
| No 🎙 "Listening" | Not on HTTPS, or microphone permission denied. Phone check shows which. |
| Questions not read aloud | Check that `SARVAM_API_KEY` is configured on the server and the device has network access. The app uses a matching installed browser voice as a fallback; answers can always be entered by tapping. |
| Camera checks show "Camera or face model unavailable" | The first load needs internet to fetch the face model (about 4 MB). Load it once on Wi-Fi; after that it is cached. |
| Forgot the PIN | PIN screen › *Forgot the PIN? Reset*. This erases unsent data on the phone. |
| Portal says "This browser cannot open sealed identities" | Import the recovery file from step 3.2, or set up a new hub key. New cases will use it; older ones need the old key. |
