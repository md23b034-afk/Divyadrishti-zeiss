# Mid-progress demo video: 2 min 30 s shot list

Record the phone screen (Chrome on Android, deployed over HTTPS) and the laptop portal. Voice on. Each block is one take.

| Time | Screen | Say (voice-over) |
|---|---|---|
| 0:00–0:12 | Title card, then the home screen | "Theme 3 asks for a voice-first, adaptive anamnesis and a way to reach a remote optometrist. This is DivyaDrishti running on the phone a store owner already has." |
| 0:12–0:45 | Tamil demo patient **R. Lakshmi** (or Telugu **G. Ramulu**, Kannada **S. Manjula**, Marathi **Sunita Patil**): consent read aloud → questions in Tamil → "சுகர் இருக்கு" → *Heard: diabetes* → the diabetes follow-ups appear | "She answers in Tamil. Because she said she has diabetes, it asks how long and when her retina was last checked. Questions that can't change her outcome are never asked: 16 of 30 here. Each one shows why it is asked." |
| 0:45–1:00 | Hindi demo patient **M. Ravi**: "अचानक काला पर्दा" → red banner → interview ends | "A sudden dark curtain is a retinal emergency. The app stops the lifestyle questions, finishes in 7, and sends him to hospital today." |
| 1:00–1:30 | Real phone: reading-distance check (live cm readout), then the tumbling E with swipe and the pinhole prompt | "The camera measures what questionnaires guess. ZEISS's own research found that self-reported viewing habits differ from measured ones. Here it measures her real reading distance from the size of her iris, then runs a tumbling-E test with a paper-pinhole retest." |
| 1:30–1:50 | Lakshmi's profile | "Her functional vision profile is near-dominant at a measured 29 cm, so she needs +1.75, not the +1.00 a reading table would give at 40 cm. Design emphasis: Near, the same input ZEISS individual lenses take. Amber, because her retina check is overdue." |
| 1:50–2:20 | Laptop portal: queue (red first, countdowns) → Lakshmi → trace with Tamil answers → *In-person examination* → Tamil reply auto-filled → Sign → FHIR button | "The optometrist sees red cases first, each with a deadline. She reads the trace, books the retina photo at Saturday's camp, and the reply goes back in Tamil. Every case exports as FHIR." |
| 2:20–2:30 | Camp-planning view, end card | "Pooled referrals show where the next specialist camp should go. Next: validating every measurement against clinic equipment with optometrists." |

**Before recording:** follow `docs/PHONE_DEMO_SETUP.md` (HTTPS, voices, PIN, Phone check, hub key). `npm run seed`, start the server with a fresh `DD_DB`, calibrate the phone once (Calibrate → screen + 40 cm), and make sure the phone has the Google Tamil and Hindi TTS voices installed.
