export const FILM_SECONDS = 118;
const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

export function smooth(a, b, t) {
  const u = a === b ? Number(t >= b) : clamp((t - a) / (b - a));
  return u * u * (3 - 2 * u);
}

function hash(i, seed = 0) {
  let n = (i + 1 + seed * 374761393) | 0;
  n = Math.imul(n ^ (n >>> 16), 2246822507);
  n = Math.imul(n ^ (n >>> 13), 3266489909);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

const GLYPHS = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '11001', '10101', '10011', '10011', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
};

const WORDS = Object.fromEntries(['CODEX', 'CLAUDE', 'GEMINI', 'GROK'].map(word => {
  const cells = [];
  for (let c = 0; c < word.length; c++) {
    for (let y = 0; y < 7; y++) for (let x = 0; x < 5; x++) {
      if (GLYPHS[word[c]][y][x] === '1') cells.push([c * 6 + x - (word.length * 6 - 2) / 2, 3 - y]);
    }
  }
  return [word, cells];
}));

function sphere(i, count, radius, twist = 0) {
  const y = 1 - 2 * (i + 0.5) / count;
  const a = i * 2.399963229728653 + twist;
  const r = Math.sqrt(1 - y * y);
  return [Math.cos(a) * r * radius, y * radius, Math.sin(a) * r * radius];
}

function shape(kind, i, count) {
  const u = (i + 0.5) / count;
  const a = hash(i), b = hash(i, 1), c = hash(i, 2);
  const grid = Math.ceil(Math.sqrt(count));
  const gx = i % grid, gz = Math.floor(i / grid);
  const x = (gx - (grid - 1) / 2) / grid;
  const z = (gz - (Math.ceil(count / grid) - 1) / 2) / grid;
  let p, r;
  if (WORDS[kind]) {
    const cells = WORDS[kind], cell = cells[i % cells.length];
    const depth = Math.floor(i / cells.length), layers = Math.ceil(count / cells.length / 2);
    return [cell[0] * 0.5, cell[1] * 0.5 + (depth % 2 - 0.5) * 0.22,
      (Math.floor(depth / 2) - (layers - 1) / 2) * 0.22, 0.45, 0.19, 0.2, 0, 0, 0];
  }
  switch (kind) {
    case 'machine': case 'unfolded': case 'shell': case 'core': case 'vortex': {
      r = kind === 'machine' ? 1.4 : kind === 'unfolded' ? 3.3 : kind === 'shell' ? 3.5 : kind === 'core' ? 4 : 1.7;
      const layer = kind === 'core' ? 0.66 + (i % 3) * 0.17 : 1;
      p = sphere(i, count, r * layer, kind === 'shell' ? 0.65 : 0);
      const side = kind === 'machine' ? 0.12 : kind === 'core' ? 0.23 : 0.24;
      return [...p, side, side * 0.64, side * 0.28, Math.atan2(-p[1], p[2]), Math.asin(p[0] / (r * layer)), a * 0.4];
    }
    case 'fragments':
      p = sphere(i, count, 3 + a * 3.5);
      return [...p, 0.1 + b * 0.65, 0.05, 0.2 + c * 0.8, b * 1.2, a * 2, c];
    case 'city-initial': case 'city': case 'processor': {
      const spread = kind === 'processor' ? 11 : kind === 'city-initial' ? 17 : 24;
      const corridor = gx % 8 === 0 || gz % 8 === 0, center = Math.exp(-(x * x + z * z) * 18);
      const h = corridor ? 0.06 : (0.25 + a * a * 3.4 + center * 4.5) * (kind === 'city-initial' ? 0.6 : kind === 'processor' ? 0.3 : 1);
      return [x * spread, -3 + h / 2, z * spread, spread / grid * 0.61, h, spread / grid * 0.52, 0, 0, 0];
    }
    case 'chip': {
      if (i < count * 0.22) {
        const side = Math.ceil(Math.sqrt(count * 0.22));
        return [(i % side - (side - 1) / 2) * 2.5 / side, 0.2,
          (Math.floor(i / side) - (side - 1) / 2) * 2.5 / side, 2.1 / side, 0.32, 2.1 / side, 0, 0, 0];
      }
      const arm = i % 4, track = Math.floor(i / 4) % 12;
      const along = 1.55 + hash(Math.floor(i / 48), 3) * 3.35, across = (track - 5.5) * 0.36;
      const edge = arm % 2 ? -1 : 1;
      return [arm < 2 ? along * edge : across, 0, arm < 2 ? across : along * edge,
        arm < 2 ? 0.2 : 0.05, 0.065, arm < 2 ? 0.05 : 0.2, 0, 0, 0];
    }
    case 'paper':
      return [x * 17, -1.8 + Math.sin(x * 7) * 0.8 + Math.cos(z * 8) * 0.7, z * 12,
        0.75 + a * 0.6, 0.035, 0.23, 0.12 * Math.sin(z * 8), 0, 0.16 * Math.cos(x * 7)];
    case 'tree': {
      const branch = i % 12, f = Math.floor(i / 12) / Math.ceil(count / 12), angle = branch * 2.39996;
      r = branch === 0 ? 0.12 : Math.pow(f, 1.5) * (2.1 + branch * 0.13);
      return [Math.cos(angle) * r, -3 + f * 7.4 - r * 0.35, Math.sin(angle) * r,
        0.06 + f * 0.22, 0.1, 0.045 + f * 0.16, 0, angle, f * 0.3];
    }
    case 'library':
      return [(i % 32 - 15.5) * 0.46, -1 + (Math.floor(i / 32) % 4) * 1.25,
        (Math.floor(i / 128) - Math.ceil(count / 128) / 2) * 0.8, 0.09 + a * 0.09, 0.76 + b * 0.3, 0.5, 0, 0, 0];
    case 'rings': case 'portal': {
      const ring = i % 6, angle = TAU * Math.floor(i / 6) / Math.ceil(count / 6);
      r = kind === 'portal' ? 3.8 + ring * 0.1 : 2.5 + ring * 0.36;
      const tilt = kind === 'portal' ? 0 : (ring - 2.5) * 0.37;
      return [Math.cos(angle) * r, Math.sin(angle) * r * Math.cos(tilt), Math.sin(angle) * r * Math.sin(tilt) + (ring - 2.5) * 0.16,
        0.12, 0.06, 0.1, tilt, 0, angle + Math.PI / 2];
    }
    case 'wave': case 'terrain': case 'massive-wave': {
      const big = kind === 'massive-wave', fold = kind === 'terrain';
      const height = Math.sin(x * (big ? 7 : 11) + z * 5) * (big ? 3.8 : 1.5);
      return [x * (big ? 30 : 19), height + (fold ? Math.abs(z) * 6 : -1.3), z * (big ? 19 : 13),
        (big ? 27 : 16) / grid, 0.045, (big ? 16 : 10) / grid,
        Math.cos(z * 5 + x * 11) * 0.3, 0, Math.cos(x * 11 + z * 5) * 0.38];
    }
    case 'prism': case 'crystal': case 'exploded': {
      const face = i % 8, step = Math.floor(i / 8) / Math.ceil(count / 8), y = (step - 0.5) * 7, angle = face * TAU / 8;
      r = (1 - Math.abs(step * 2 - 1)) * (kind === 'prism' ? 3.7 : 3.1) + 0.15;
      p = [Math.cos(angle) * r, y, Math.sin(angle) * r];
      if (kind === 'exploded') p = p.map((v, axis) => v * 1.5 + (hash(i, axis + 4) - 0.5) * 2);
      return [...p, 0.5 + a * 0.4, 0.065, 0.09, 0.2, -angle, (face % 2 ? -1 : 1) * 0.35];
    }
    case 'humanoid': {
      const part = i % 10, q = Math.floor(i / 10) / Math.ceil(count / 10);
      if (part < 2) { p = sphere(i, count, 0.68); return [p[0], p[1] + 2.65, p[2], 0.08, 0.07, 0.09, 0, 0, 0]; }
      if (part < 6) return [(a - 0.5) * (1.35 - q * 0.35), 0.1 + q * 1.85, (b - 0.5) * 0.62, 0.085, 0.12, 0.06, 0, 0, 0];
      const sign = part % 2 ? -1 : 1, arm = part < 8;
      return [sign * (arm ? 0.62 + q * 1.45 : 0.27 + q * 0.5), arm ? 1.7 - q * 1.55 : 0.1 - q * 3,
        (b - 0.5) * 0.34, 0.065, 0.13, 0.075, 0, 0, sign * (arm ? 0.7 : 0.12)];
    }
    case 'line': return [(u - 0.5) * 24, 0, 0, 0.022, 0.12, 0.11, 0, 0, 0];
    case 'highway': return [(i % 8 - 3.5) * 0.8, -2.4, (Math.floor(i / 8) / Math.ceil(count / 8) - 0.5) * 38, 0.11, 0.08, 0.14, 0, 0, 0];
    case 'towers': {
      const side = i % 2 ? -1 : 1, row = Math.floor(i / 2) % 32, tier = Math.floor(i / 64), h = 0.7 + a * 5;
      return [side * (6.7 + (tier % 4) * 0.85), -3 + h / 2, (row - 15.5) * 0.9, 0.28, h, 0.36, 0, 0, 0];
    }
    case 'network': return [(a - 0.5) * 16, (b - 0.5) * 9, (c - 0.5) * 10, 0.07, 0.07, 0.07, 0, 0, 0];
    case 'artifacts': case 'orbit-artifacts': {
      const group = i % 4, angle = group * Math.PI / 2 + (kind === 'orbit-artifacts' ? 0.3 : 0);
      p = sphere(Math.floor(i / 4), Math.ceil(count / 4), 1.12);
      return [p[0] + Math.cos(angle) * 4.3, p[1] + Math.sin(angle) * 2.5, p[2] + (group % 2 - 0.5) * 1.3,
        0.19, group === 1 ? 0.045 : 0.12, 0.1, 0, angle, group === 2 ? Math.PI / 4 : 0];
    }
    case 'offscreen': return [(a - 0.5) * 30, 19 + b * 5, -22 - c * 3, 0.001, 0.001, 0.001, 0, 0, 0];
    default: throw new Error(`Unknown formation: ${kind}`);
  }
}

const BEATS = [
  [0, 'machine'], [2, 'machine'], [6, 'unfolded'], [10, 'fragments'],
  [14, 'city-initial'], [18, 'city'], [22, 'CODEX'], [24, 'CODEX'], [27, 'processor'],
  [29, 'chip'], [31, 'chip'], [34, 'shell'], [36, 'shell'], [40, 'paper'],
  [44, 'tree'], [46, 'CLAUDE'], [48, 'CLAUDE'], [51, 'library'], [55, 'rings'],
  [58, 'portal'], [61, 'wave'], [65, 'prism'], [68, 'humanoid'], [70, 'GEMINI'],
  [71, 'GEMINI'], [75, 'terrain'], [77, 'crystal'], [79, 'exploded'], [81, 'line'],
  [84, 'highway'], [88, 'towers'], [91, 'GROK'], [94, 'GROK'], [94.5, 'GROK'],
  [96, 'GROK'], [98, 'network'], [102, 'vortex'], [104, 'artifacts'],
  [106, 'orbit-artifacts'], [110, 'core'], [113, 'core'], [115, 'massive-wave'],
  [117, 'offscreen'], [118, 'offscreen'],
];

export function makeChoreography(count) {
  if (!Number.isInteger(count) || count < 1 || count > 65536) throw new RangeError('count must be an integer from 1 to 65536');
  const frames = BEATS.map(([time, name]) => {
    const positions = new Float32Array(count * 3), scales = new Float32Array(count * 3), rotations = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const values = shape(name, i, count);
      positions.set(values.slice(0, 3), i * 3); scales.set(values.slice(3, 6), i * 3); rotations.set(values.slice(6, 9), i * 3);
    }
    return { time, positions, scales, rotations, name };
  });
  const links = [];
  for (let i = 0; i < count; i += 3) if (count > 1) links.push({ a: i, b: (i + 17) % count === i ? (i + 1) % count : (i + 17) % count });
  return { frames, links };
}

function hermite(p0, m0, p1, m1, t) {
  const t2 = t * t, t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  return p0 * h00 + m0 * h10 + p1 * h01 + m1 * h11;
}

const CAM_KEYS = [
  { t: 0, pos: [0, 0, 7.8], tar: [0, 0, 0], roll: 0, fov: 42 },
  { t: 2, pos: [0, 0, 8.4], tar: [0, 0, 0], roll: 0, fov: 43 },
  { t: 6, pos: [2.5, 1.2, 12], tar: [0, 0, 0], roll: 0.03, fov: 45 },
  { t: 10, pos: [-4.2, 2.8, 16], tar: [0, 0, 0], roll: -0.04, fov: 48 },
  { t: 14, pos: [0, 5.5, 23], tar: [0, -1, 0], roll: 0, fov: 46 },
  { t: 18, pos: [3.5, 4.2, 21], tar: [0, -1, 0], roll: 0.02, fov: 45 },
  { t: 22, pos: [0, 0.4, 21.5], tar: [0, 0.2, 0], roll: 0, fov: 42 },
  { t: 24, pos: [0, 0.4, 21.5], tar: [0, 0.2, 0], roll: 0, fov: 42 },
  { t: 27, pos: [3.8, 3.2, 17], tar: [0, -0.6, 0], roll: 0.03, fov: 44 },
  { t: 29, pos: [0, 10.5, 12], tar: [0, 0, 0], roll: 0, fov: 45 },
  { t: 31, pos: [0, 10.5, 12], tar: [0, 0, 0], roll: 0, fov: 45 },
  { t: 34, pos: [7.8, 2.4, 11], tar: [0, 0, 0], roll: 0.05, fov: 45 },
  { t: 36, pos: [7.8, 2.4, 11], tar: [0, 0, 0], roll: 0.05, fov: 45 },
  { t: 40, pos: [-4.5, 3.2, 18], tar: [0, -0.8, 0], roll: -0.03, fov: 45 },
  { t: 44, pos: [5.2, 1.8, 15], tar: [0, 0.6, 0], roll: 0.04, fov: 45 },
  { t: 46, pos: [0, 0.4, 22], tar: [0, 0.2, 0], roll: 0, fov: 42 },
  { t: 48, pos: [0, 0.4, 22], tar: [0, 0.2, 0], roll: 0, fov: 42 },
  { t: 51, pos: [-3.4, 2.6, 17], tar: [0, 0, 0], roll: -0.02, fov: 45 },
  { t: 55, pos: [6.4, 1.2, 13], tar: [0, 0, 0], roll: 0.06, fov: 45 },
  { t: 58, pos: [0, 0.3, 15], tar: [0, 0, 0], roll: 0, fov: 44 },
  { t: 61, pos: [0, 4.8, 20], tar: [0, -0.5, 0], roll: 0, fov: 46 },
  { t: 65, pos: [-5.6, 2.2, 14], tar: [0, 0, 0], roll: -0.05, fov: 45 },
  { t: 68, pos: [0, 0.8, 13.5], tar: [0, 0.6, 0], roll: 0, fov: 43 },
  { t: 70, pos: [0, 0.4, 23], tar: [0, 0.2, 0], roll: 0, fov: 42 },
  { t: 71, pos: [0, 0.4, 23], tar: [0, 0.2, 0], roll: 0, fov: 42 },
  { t: 75, pos: [3.5, 5.1, 18], tar: [0, 0, 0], roll: 0.03, fov: 46 },
  { t: 77, pos: [-6.8, 1.5, 12], tar: [0, 0, 0], roll: -0.04, fov: 45 },
  { t: 79, pos: [7.2, 2.6, 14], tar: [0, 0, 0], roll: 0.05, fov: 46 },
  { t: 81, pos: [0, 1.4, 17], tar: [0, 0, 0], roll: 0, fov: 44 },
  { t: 84, pos: [0, 2.2, 22], tar: [0, -1, -5], roll: 0, fov: 46 },
  { t: 88, pos: [0, 1.8, 19], tar: [0, 0, 0], roll: 0, fov: 45 },
  { t: 91, pos: [0.7, 0.6, 21], tar: [0, 0.2, 0], roll: 0, fov: 42 },
  { t: 94, pos: [0.05, 0.42, 20.1], tar: [0, 0.2, 0], roll: 0, fov: 42 },
  { t: 94.5, pos: [0, 0.4, 20], tar: [0, 0.2, 0], roll: 0, fov: 42 },
  { t: 96, pos: [0, 0.4, 20], tar: [0, 0.2, 0], roll: 0, fov: 42 },
  { t: 98, pos: [-4.6, 2.4, 16], tar: [0, 0, 0], roll: -0.03, fov: 46 },
  { t: 102, pos: [5.8, 1.6, 12], tar: [0, 0, 0], roll: 0.04, fov: 45 },
  { t: 104, pos: [-6.2, 2.2, 15], tar: [0, 0, 0], roll: -0.03, fov: 45 },
  { t: 106, pos: [6.2, 2.2, 15], tar: [0, 0, 0], roll: 0.03, fov: 45 },
  { t: 110, pos: [0, 1.1, 18], tar: [0, 0, 0], roll: 0, fov: 44 },
  { t: 113, pos: [0, 1.1, 18], tar: [0, 0, 0], roll: 0, fov: 44 },
  { t: 115, pos: [0, 6.2, 25], tar: [0, 0, 0], roll: 0, fov: 47 },
  { t: 117, pos: [0, 0, 20], tar: [0, 0, 0], roll: 0, fov: 45 },
  { t: 118, pos: [0, 0, 20], tar: [0, 0, 0], roll: 0, fov: 45 }
];

function tangent(arr, idx, prop, axis) {
  if (idx === 0 || idx === arr.length - 1) return 0;
  const curr = arr[idx];
  if (curr.t >= 94.5 && curr.t <= 96) return 0;
  const prev = arr[idx - 1], next = arr[idx + 1];
  const dt1 = curr.t - prev.t, dt2 = next.t - curr.t;
  const pPrev = axis === undefined ? prev[prop] : prev[prop][axis];
  const pCurr = axis === undefined ? curr[prop] : curr[prop][axis];
  const pNext = axis === undefined ? next[prop] : next[prop][axis];
  const d1 = (pCurr - pPrev) / dt1, d2 = (pNext - pCurr) / dt2;
  if (d1 * d2 <= 0) return 0;
  return (2 * d1 * d2) / (d1 + d2);
}

export function cameraAt(t, aspect = 16 / 9) {
  if (!Number.isFinite(t) || !Number.isFinite(aspect) || aspect <= 0) throw new RangeError('time must be finite; aspect must be positive and finite');
  const time = clamp(t, 0, FILM_SECONDS);
  let k = 0;
  while (k < CAM_KEYS.length - 2 && CAM_KEYS[k + 1].t < time) k++;
  const k0 = CAM_KEYS[k], k1 = CAM_KEYS[k + 1];
  const dt = k1.t - k0.t;
  const u = clamp((time - k0.t) / dt);
  const sample = (prop, axis) => {
    const p0 = axis === undefined ? k0[prop] : k0[prop][axis];
    const p1 = axis === undefined ? k1[prop] : k1[prop][axis];
    if (p0 === p1) return p0;
    return hermite(p0, tangent(CAM_KEYS, k, prop, axis) * dt,
      p1, tangent(CAM_KEYS, k + 1, prop, axis) * dt, u);
  };
  const target = [0, 1, 2].map(axis => sample('tar', axis));
  const position = [0, 1, 2].map(axis => sample('pos', axis));
  const roll = sample('roll');
  let fov = sample('fov');
  const ratio = Math.max(1, (16 / 9) / aspect);
  const radiusFactor = Math.min(1.6, Math.sqrt(ratio));
  for (let axis = 0; axis < 3; axis++) position[axis] = target[axis] + (position[axis] - target[axis]) * radiusFactor;
  // Keep horizontal framing without letting portrait distance grow unbounded.
  fov = Math.min(100, Math.atan(Math.tan(fov * Math.PI / 360) * ratio / radiusFactor) * 360 / Math.PI);
  return { position, target, roll, fov };
}
