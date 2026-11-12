// Optics and camera geometry for the no-device measurements.
// Pure functions (no DOM, no camera) so they can be unit-tested.

// Horizontal visible iris diameter is ~11.7 ± 0.5 mm across adults; MediaPipe
// Iris uses the same constant to estimate metric depth (<10% error reported).
export const IRIS_MM = 11.7;
export const ID_CARD_MM = 85.6; // ISO/IEC 7810 ID-1 (Aadhaar PVC card, bank card)

// MediaPipe FaceLandmarker (478 points, iris refined): iris centres and rings.
export const LM = { IRIS_A: 468, IRIS_A_RING: [469, 470, 471, 472], IRIS_B: 473, IRIS_B_RING: [474, 475, 476, 477], NOSE_BRIDGE: 168 };

const px = (p, W, H) => ({ x: p.x * W, y: p.y * H });

export function irisDiameterPx(landmarks, ring, W, H) {
  const pts = ring.map((i) => px(landmarks[i], W, H));
  const xs = pts.map((p) => p.x);
  return Math.max(...xs) - Math.min(...xs);
}

// Focal length in pixels for an assumed horizontal field of view, used until
// the device is calibrated.
export const defaultFocalPx = (imageWidthPx, hfovDeg = 63) => (imageWidthPx / 2) / Math.tan((hfovDeg * Math.PI) / 360);

// One-time per-device calibration: hold the phone at a known distance
// (the 40 cm cord used for near-vision charts) and read the iris size.
export const focalFromCalibration = (irisPx, knownDistanceMm, irisMm = IRIS_MM) => (irisPx * knownDistanceMm) / irisMm;

export const distanceFromIrisMm = (irisPx, focalPx, irisMm = IRIS_MM) => (irisPx > 0 ? (focalPx * irisMm) / irisPx : null);

// Read both eyes from a face. Returns pixel positions plus iris sizes.
// The raw camera frame is not mirrored: the patient's right eye (OD) is on
// the image's left.
export function eyesFromLandmarks(landmarks, W, H) {
  const a = px(landmarks[LM.IRIS_A], W, H);
  const b = px(landmarks[LM.IRIS_B], W, H);
  const da = irisDiameterPx(landmarks, LM.IRIS_A_RING, W, H);
  const db = irisDiameterPx(landmarks, LM.IRIS_B_RING, W, H);
  const bridge = px(landmarks[LM.NOSE_BRIDGE], W, H);
  const [od, os, dOd, dOs] = a.x < b.x ? [a, b, da, db] : [b, a, db, da];
  return { od, os, irisOdPx: dOd, irisOsPx: dOs, irisPx: (dOd + dOs) / 2, bridge };
}

// Convergence: while fixating the phone at distance Z, each eye turns in and
// the pupils sit closer than for distance vision. Pupil is ~10.5 mm in front
// of the eye's centre of rotation.
export function distancePdFromNear(measuredPdMm, fixationMm, pupilToCorMm = 10.5) {
  const theta = Math.atan((measuredPdMm / 2) / (fixationMm + pupilToCorMm));
  return measuredPdMm + 2 * pupilToCorMm * Math.sin(theta);
}

// Near centration distance at the spectacle plane for a working distance
// (spectacle plane ~27 mm in front of the centre of rotation).
export const nearPdMm = (distancePd, workingDistanceMm, planeToCorMm = 27) => (distancePd * workingDistanceMm) / (workingDistanceMm + planeToCorMm);

// Full PD measurement from one frame.
// scale: { method: 'iris' } or { method: 'card', cardPx, eyeDistanceMm }
export function measurePd(eyes, { method = 'iris', cardPx = null, eyeDistanceMm = 400, cardInFrontMm = 12 } = {}) {
  let mmPerPx;
  if (method === 'card' && cardPx) {
    // The card on the forehead sits ~12 mm closer to the camera than the pupils.
    mmPerPx = (ID_CARD_MM / cardPx) * (eyeDistanceMm / (eyeDistanceMm - cardInFrontMm));
  } else {
    mmPerPx = IRIS_MM / eyes.irisPx;
  }
  const pdPx = Math.hypot(eyes.os.x - eyes.od.x, eyes.os.y - eyes.od.y);
  const measured = pdPx * mmPerPx;
  const distance = distancePdFromNear(measured, eyeDistanceMm);
  const k = distance / measured;
  const rightMm = Math.abs(eyes.bridge.x - eyes.od.x) * mmPerPx * k;
  const leftMm = Math.abs(eyes.os.x - eyes.bridge.x) * mmPerPx * k;
  const uncertaintyMm = method === 'card' ? 1.5 : Math.max(1.5, distance * (0.5 / IRIS_MM)); // ±0.5 mm HVID spread ≈ ±4%
  return {
    method,
    mmPerPx,
    measuredMm: round1(measured),
    binocularMm: round1(distance),
    rightMm: round1(rightMm),
    leftMm: round1(leftMm),
    nearMm: round1(nearPdMm(distance, 400)),
    uncertaintyMm: round1(uncertaintyMm),
  };
}

export const fittingHeightMm = (pupilY, rimY, mmPerPx) => round1((rimY - pupilY) * mmPerPx);

// Head pose from the eye landmarks: a tilted (roll) or turned (yaw) head
// shortens the apparent PD and shifts monocular PDs, so capture is blocked
// until the head is straight. Thresholds: roll <= 4°, left/right asymmetry <= 12%
// (normal facial asymmetry is a few percent).
export function faceQuality(eyes, { maxRollDeg = 4, maxYawPct = 12 } = {}) {
  const rollDeg = (Math.atan2(eyes.os.y - eyes.od.y, eyes.os.x - eyes.od.x) * 180) / Math.PI;
  const r = Math.abs(eyes.bridge.x - eyes.od.x);
  const l = Math.abs(eyes.os.x - eyes.bridge.x);
  const yawPct = (Math.abs(r - l) / ((r + l) / 2)) * 100;
  return { rollDeg: round1(rollDeg), yawPct: round1(yawPct), ok: Math.abs(rollDeg) <= maxRollDeg && yawPct <= maxYawPct };
}

// Prentice's rule: induced prism (Δ) = decentration (cm) × lens power (D).
export const prenticePrismD = (decentrationMm, powerD) => (Math.abs(decentrationMm) / 10) * Math.abs(powerD);

// How much a PD error matters for this patient's prescription.
export function pdTolerance(pdUncertaintyMm, rx) {
  const powers = ['R', 'L'].map((e) => rx?.[e]).filter(Boolean).map((r) => Math.max(Math.abs(r.sph), Math.abs(r.sph + (r.cyl || 0))));
  if (!powers.length) return null;
  const p = Math.max(...powers);
  const prism = prenticePrismD(pdUncertaintyMm / 2, p) * 2; // error splits across both lenses
  return { maxPowerD: p, worstCasePrismD: Math.round(prism * 100) / 100, acceptable: prism <= 0.67 };
}

// Optotype height for a logMAR level at a viewing distance: a 0.0 logMAR
// (6/6) letter subtends 5 arc-minutes.
export const optotypeMm = (logmar, distanceMm) => distanceMm * Math.tan(((5 / 60) * Math.PI) / 180) * 10 ** logmar;

// Default CSS-px-per-mm before screen calibration (phones are ~6, desktops ~3.8).
export const defaultPxPerMm = (isPhone) => (isPhone ? 6.0 : 96 / 25.4);

export function median(values) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

// Is the last `n` samples stable within `tolPct` of their median?
export function isStable(values, n = 15, tolPct = 0.04) {
  if (values.length < n) return false;
  const last = values.slice(-n);
  const med = median(last);
  return last.every((x) => Math.abs(x - med) / med <= tolPct);
}

function round1(v) { return Math.round(v * 10) / 10; }
