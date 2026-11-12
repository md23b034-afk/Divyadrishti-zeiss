# Clinical logic and evidence

Every rule below is implemented in `web/js/engine/profile.js` and `web/js/engine/questions.js` and covered by tests in `tests/engine/`. They are **proposed** rules, written to be reviewed line by line with optometrists before use.

## 1. Adaptive anamnesis

- 30-question bank in clinical order: core → red flags → child → medical → current glasses → visual tasks → preference.
- A question is asked only when its answer can change triage or the lens decision for this patient (its `when` rule). Examples: farmers are not asked about computer screens (the occupation prior already says 0 h); glaucoma family history and cataract surgery are asked from 40; falls from 65; budget only when the lens choice spans a price range.
- **Urgent mode:** a red flag drops every remaining non-urgent question.
- Each asked question is logged with the reason it was asked, the patient's own words and the parsed value.
- Measured on the 8 synthetic personas: 7 to 21 questions asked out of 30, median 16. The red-flag patient finishes in 7.

## 2. Triage lanes

| Lane | Triggers | Target |
|---|---|---|
| **Red** (same day, no glasses today) | sudden vision loss / flashes / curtain / new double vision; painful red eye with blur, haloes or injury; white pupil reflex in a child | optometrist call-back within 2 h, same-day hospital |
| **Amber** (referral) | diabetes with retina check overdue (>1 y or never); glaucoma in a first-degree relative, age 40+; possible cataract (50+ with glare/faded colours, unstable power, or reduced vision a pinhole does not improve); reduced vision unexplained by glasses (pinhole test); worse than 6/60; Amsler distortion; child squint or difficulty with the board; anisometropia ≥ 2 D; high myopia ≤ −6 D; high hyperopia; cylinder ≥ 3 D; discomfort with current progressives (centration check) | review within 24 h |
| **Green** (sign-off) | none of the above | batch review within 72 h |

## 3. Functional Vision Profile

- Hours per zone: **near** (reading, phone, sewing ~25–40 cm), **intermediate** (screen, counter, loom ~66 cm), **distance**. Each comes from the patient's answer or, if not asked, from an occupation prior (`OCC_PRIORS`). The source is shown.
- Dominance: the top zone if its share is ≥ 45 % and leads the next by ≥ 12 points; otherwise *balanced*.
- **Design emphasis:** Near / Intermediate / Balanced. This is the same three-way choice ZEISS Progressive Individual 2 and SmartLife individual designs take from "a few simple lifestyle questions" (Intermediate option: up to 25 % larger intermediate zone; Near: up to 30 % larger near zone).
- Near working distance: **measured** with the camera when available (habitual reading distance), else typical for the occupation (tailor 30 cm, goldsmith 25 cm, office 40 cm).

## 4. Accommodation and reading add

- Minimum expected amplitude (Hofstetter 1950): `A = 15 − 0.25 × age` D. If the near point was measured, `A = 100 / near point (cm)`.
- After cataract surgery (pseudophakia): `A ≈ 0.5 D`, whatever the age.
- Tentative add = near demand − A/2 (half the amplitude kept in reserve), rounded to 0.25 D, capped at +3.50 D. Symptomatic patients aged 38+ get at least +0.75 D.
- At 40 cm this gives +1.25 D at 50, +2.00 D at 55 and +2.50 D at 60, in line with the usual age tables.
- Working distance matters: at 47, a tailor sewing at 30 cm gets +1.75 D, while someone reading at 40 cm gets +1.00 D.

## 5. Lens category (in order)

1. Red lane → no glasses today.
2. Child (<16) → cycloplegic refraction, then single vision. With moderate/high myopia risk, discuss myopia management (e.g. ZEISS MyoCare, ages 6–12) after confirmation.
3. No add needed → single-vision distance (or no change).
4. Age 65+ with a fall and outdoor activity → **two pairs**: single-vision distance for walking plus readers (VISIBLE trial).
5. Near ≥ 50 % with little distance or arm's-length work → reading glasses at the measured distance; ready-made readers once the optometrist approves the add.
6. Intermediate-dominant, or near + intermediate ≥ 75 % → office / near-variable lens (one-pair alternative: progressive, Intermediate/Near design).
7. Low budget, or already comfortable in bifocals → bifocal.
8. Otherwise → progressive with the profile's design emphasis.

Coatings: anti-reflective for night driving and glare; UV and photochromic for 4+ h of sun; impact-resistant for children and manual work.

### Blue-light ("blue ray") lenses for laptop users: checked again

Many stores, chains included, sell blue-cut lenses as a fix for screen strain. The evidence does not support that claim:

- **Cochrane review (Singh et al., 2023, 17 randomised trials):** blue-light filtering lenses *probably make no difference* to eye strain from computer use (short-term follow-up, low-certainty evidence). The authors do not know whether they help sleep (very low certainty), found no study of retinal (macular) protection, and found no consistent harms. Their conclusion: the findings do not support prescribing them to the general population. Typical lenses filter only about 10–25% of blue light.
- **American Academy of Ophthalmology:** does not recommend any special eyewear for computer use. Screen strain comes from *how* we use screens (reduced blinking and sustained focusing at close range), not from the screen's light.
- **Newer studies (2024–2025)** are mostly observational or small and do not change the picture.

**What the app does:** it never presents a blue-light filter as a treatment. It may be offered as a preference: it is harmless, and some in-material designs also block UV and cut reflections. The app states the evidence and recommends what does relieve screen strain:
1. the right power at the screen distance (for presbyopes, an intermediate add or office lens; this is where the engine's Intermediate design emphasis comes from);
2. correcting small uncorrected errors;
3. an anti-reflective coating;
4. blinking and 20-20-20 breaks.

This corrects a claim in our own idea-stage deck.

## 6. Child myopia risk score

+2 outdoors < 2 h/day; +1 near work > 3 h (+2 if > 5 h); +1 one myopic parent, +2 both; +1 measured reading distance < 25 cm; +2 trouble with the school board; +1 if under 10 and any risk. High ≥ 4, moderate 2–3. Outdoor time is the modifiable factor (He et al. 2015: an extra 40 min outdoors at school cut 3-year myopia incidence from 39.5 % to 30.4 %).

## 7. Camera measurements (`web/js/measure/geometry.js`)

- **Distance from the iris:** horizontal visible iris diameter ≈ 11.7 ± 0.5 mm (±4 %); `Z = f × 11.7 / iris_px`. The focal length comes from a one-time 40 cm calibration per phone (default: 63° lens, about ±15 %). MediaPipe Iris reports under 10 % depth error.
- **PD:** pupil separation × (11.7 / iris px) is depth-independent. Optionally an ID-1 card (85.6 mm) on the forehead gives the scale, corrected for the card sitting ~12 mm in front of the eyes. Convergence correction from near fixation back to distance PD (pupil ~10.5 mm in front of the centre of rotation). Near PD at the spectacle plane: `PD × w / (w + 27 mm)`.
- **Prentice's rule** (prism = decentration in cm × power) converts PD uncertainty into induced prism for *this patient's* power, so a ±2 mm PD is fine at −1 D and not at −6 D.
- **Acuity:** tumbling E, 5 arc-minutes at logMAR 0, sized from the screen calibration (card-matching slider). Staircase: pass 2 of 3, 0.2 steps then 0.1. Paper-pinhole retest when vision is 6/19 or worse: improvement by 2 lines means refractive error; no improvement means eye disease, so refer.
- Smartphone PD apps read slightly low against pupillometers and are considered screening-grade (Jung & Chu 2024; Han et al. 2023). **Validation against a pupillometer, autorefractor and tape is the first pilot task.**

## References

- Hofstetter HW. A useful age-amplitude formula. *Optom World* 1950;38:42–45.
- He M et al. Effect of time spent outdoors at school on the development of myopia among children in China. *JAMA* 2015;314(11):1142–1148.
- Haran MJ et al. Effect on falls of providing single lens distance vision glasses to multifocal glasses wearers: VISIBLE randomised controlled trial. *BMJ* 2010;340:c2265.
- Singh S et al. Blue-light filtering spectacle lenses for visual performance, sleep, and macular health in adults. *Cochrane Database Syst Rev* 2023 (CD013244.pub2).
- American Academy of Ophthalmology: no special eyewear recommended for computer use; screen strain comes from usage habits.
- Bastawrous A et al. Development and validation of a smartphone-based visual acuity test (Peek Acuity). *JAMA Ophthalmol* 2015;133(8):930–937. Mean difference vs ETDRS 0.07 logMAR; used by lay health workers.
- Google Research. MediaPipe Iris: real-time iris tracking and depth estimation (2020).
- Jung & Chu. A comparative analysis of interpupillary distance measurement techniques. *Clin Optom* 2024. Han et al. Comparing smartphone applications for IPD. *Cureus* 2023.
- ZEISS Progressive Individual 2 ECP brochure (Balanced / Intermediate / Near). ZEISS SmartLife Individual 3 press release, Feb 2023.
- Marmamula S, Keeffe JE, Rao GN. RARE study, Mahabubnagar. *Ophthalmic Epidemiol* 2009: presbyopia 63.7 % over 35; near-vision spectacle coverage 19 %.
- Sheeladevi S et al. Refractive errors and presbyopia in adults in India: a systematic review. *Indian J Ophthalmol* 2019 (uncorrected presbyopia ~33 %).
- International Council of Ophthalmology. Guidelines for diabetic eye care (annual retinal examination).
