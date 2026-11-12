// Front-camera face tracking with MediaPipe Face Landmarker (478 landmarks,
// iris refined), running on-device in the browser: no image leaves the phone.
import { eyesFromLandmarks, distanceFromIrisMm } from './geometry.js';

const MP_VERSION = '0.10.14';
const MP_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`;
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

let landmarkerP = null;
export function loadLandmarker() {
  if (landmarkerP) return landmarkerP;
  landmarkerP = (async () => {
    const vision = await import(/* @vite-ignore */ `${MP_URL}/vision_bundle.mjs`);
    const fileset = await vision.FilesetResolver.forVisionTasks(`${MP_URL}/wasm`);
    const opts = (delegate) => ({ baseOptions: { modelAssetPath: MODEL_URL, delegate }, runningMode: 'VIDEO', numFaces: 1 });
    try { return await vision.FaceLandmarker.createFromOptions(fileset, opts('GPU')); }
    catch { return vision.FaceLandmarker.createFromOptions(fileset, opts('CPU')); }
  })();
  landmarkerP.catch(() => { landmarkerP = null; });
  return landmarkerP;
}

export async function startCamera(video) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false,
  });
  video.srcObject = stream;
  video.playsInline = true;
  video.muted = true;
  await video.play();
  return stream;
}

export const stopCamera = (stream) => stream?.getTracks().forEach((t) => t.stop());

// Calls onFrame({ eyes, distanceMm, W, H, landmarks }) per new video frame,
// or onFrame(null) when no face is found. Returns a stop() function.
export function track(video, landmarker, onFrame, focalPxFor) {
  let running = true;
  let lastTime = -1;
  const loop = () => {
    if (!running || !video || !video.isConnected) return;
    if (video.readyState >= 2 && video.currentTime !== lastTime) {
      lastTime = video.currentTime;
      let res = null;
      try { res = landmarker.detectForVideo(video, performance.now()); } catch { res = null; }
      const lm = res?.faceLandmarks?.[0];
      if (lm && lm.length >= 478) {
        const W = video.videoWidth; const H = video.videoHeight;
        const eyes = eyesFromLandmarks(lm, W, H);
        onFrame({ eyes, distanceMm: distanceFromIrisMm(eyes.irisPx, focalPxFor(W)), W, H, landmarks: lm });
      } else {
        onFrame(null);
      }
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  return () => { running = false; };
}
