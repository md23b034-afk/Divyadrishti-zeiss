// Language packs added beyond the built-in English, Hindi and Tamil.
// Adding a language = one pack file here + its speech locale; a native
// reviewer checks exactly one file.
import te from './te.js';
import mr from './mr.js';
import kn from './kn.js';

export const PACKS = [te, mr, kn];
export const PACK_BY_CODE = Object.fromEntries(PACKS.map((p) => [p.code, p]));
