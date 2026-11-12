# The Remote Optometrist Bridge: proposed operating model

## Why a bridge and not a tele-consult

A video call needs bandwidth, a scheduled optometrist and a patient who waits. Rural eye care in India already runs on a better pattern: a trained technician at the edge, and an expert reviewing remotely. Aravind's ~100 tele-enabled vision centres handle about 7 lakh visits a year this way. eSanjeevani's hub-and-spoke model links 1.3 lakh Ayushman Arogya Mandirs to about 17,000 hubs. DivyaDrishti brings that pattern to the optical store and the eye camp, **asynchronously**: each case is a structured packet of a few kilobytes that travels over 2G when signal allows.

## Roles

| Role | Who | Does |
|---|---|---|
| **Spoke** | Small optical-store owner, eye-camp volunteer, ASHA | Runs the 6–8 minute voice interview and the phone checks; dispenses only after sign-off |
| **Hub** | Optometrist at a ZEISS Vision Center, partner hospital or vision centre | Reviews the queue by lane, signs off or redirects, replies |
| **Escalation** | Ophthalmologist at the partner hospital, or via eSanjeevani | Red-lane cases and the referrals the hub requests |

## Service levels

| Lane | Target | What happens |
|---|---|---|
| Red | call-back within 2 h | No glasses today. The store gets a referral slip; the patient gets the hospital and "today" in their language |
| Amber | review within 24 h | Booked into the next camp or vision-centre slot for the specific test (retina photo, eye pressure, slit lamp, cycloplegic refraction) |
| Green | batch review within 72 h | Sign-off on lens category, design emphasis and add; ready-made readers can be dispensed once approved |

## Capacity: the hypothesis to test

A comprehensive exam takes the optometrist the full chair time. Reviewing a structured case (profile, measurements, trace with reasons) is a reading task, and the pilot target is **under 5 minutes per green case**. Only amber and red cases need the optometrist's hands. If that holds, one hub optometrist can cover many spokes. We will measure review minutes per case, the share of cases that are green, and referral completion before claiming a ratio.

## Closing the loop

- The review returns to the phone. The patient gets a **Vision Passport**: profile, suggested lens, next step and two tips, in their own language, one WhatsApp/SMS message long. It works at any store or camp.
- Pooled, de-identified counts (the portal's *Camp planning* view) show where referrals cluster by PIN code and which specialist camp to run next. Example: many diabetics overdue for retina checks in 631501 means bringing a fundus camera there next.

## Data and compliance (designed in, to be confirmed with counsel)

- **Consent first:** the server refuses cases without recorded consent (time, language, text version). DPDP Act 2023; DPDP Rules notified November 2025.
- **Minimisation:** camera images never leave the phone, only measurements. Erasure on request (`DELETE /api/cases/{id}`).
- **Residency:** deploy in `asia-south1` (Mumbai).
- **Interoperability:** FHIR R4 bundle per case (Patient, QuestionnaireResponse with original-language answers, Observations, VisionPrescription, Flag, ServiceRequest, ClinicalImpression). Next: NRCeS/ABDM profiles, an ABHA link, and LOINC/SNOMED CT codes.
- **Scope of practice:** the app screens and routes; the optometrist decides. Every lens decision carries a named reviewer and registration number.

## Pilot plan (4 weeks after the hackathon)

1. **Validate the measurements.** On 30 adults: PD against a pupillometer, reading distance and near point against a tape, acuity against the store chart. Report the errors honestly.
2. **Clinical review.** Two optometrists review the rule set and 50 cases blind: agreement with the app's lane and lens category.
3. **Language.** Native-speaker review of the Tamil and Hindi text; record 200 real answers to measure parse accuracy.
4. **Live pilot.** Three Velachery-type stores and one Kanchipuram camp. KPIs: minutes per patient, questions asked, review minutes per case, % green, referral completion at 30 days, remakes.

## What it means for ZEISS

- **Reach:** India has 1–1.45 lakh optical stores and about 60 % of them estimate power by hand (team survey estimate); ZEISS Vision Centers went from 3 (2022) to 20+ (late 2025). The bridge lets each hub optometrist serve stores that will never own VISUFIT-class hardware.
- **Fit with the digital chain:** the profile outputs the inputs ZEISS lens ordering already uses: design emphasis (Balanced / Intermediate / Near), add, PD and fitting height. It is a no-device front end for the VISUFIT 1000 → VISUCONSULT 500 → VISUSTORE workflow (integration proposed, not built).
- **Better data than self-report:** measured reading distance and near point address the gap ZEISS's own SmartLife research found between questionnaire answers and real visual behaviour.
