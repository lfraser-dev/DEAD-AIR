// DEAD AIR: the helicopter. Its model (built from the fitted upgrades, so every upgrade shows) and its flight.
//
// Flying works like the helicopters in Battlefield 2042:
//   W / S      collective: more or less lift from the rotor (let go to hover, with FLIGHT ASSIST on)
//   A / D      yaw: turn the nose left / right on the spot (tail rotor)
//   mouse      pitch (up / down) and roll (left / right). Tilt the helicopter to fly that way.
//   arrows     pitch and roll too, for trackpads
// FLIGHT ASSIST (on by default) levels you out when you let go of the mouse, holds your height and keeps your speed
// when you tip forward. Turn it off in the hangar for full control.
// Local frame: -Z forward, +Y up, +X right. Body rates: w[0] pitch (+ = nose up), w[1] yaw (+ = left), w[2] roll (+ = left).
import { compose, mul, mat4, clamp, damp } from '../math.js';
import { DECAL_COLS } from './hulls.js';
import { WATER } from './terrain.js';

// ---------------------------------------------------------------- quaternions
export const qmul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
export function qrot(q, v) {
  const [x, y, z, w] = q;
  const tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]);
  return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)];
}
export const qaxis = (ax, a) => { const s = Math.sin(a / 2); return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(a / 2)]; };
const qnorm = (q) => { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return q.map((v) => v / l); };
export function qmat(out, q, p) {
  const [x, y, z, w] = q;
  out[0] = 1 - 2 * (y * y + z * z); out[1] = 2 * (x * y + z * w); out[2] = 2 * (x * z - y * w); out[3] = 0;
  out[4] = 2 * (x * y - z * w); out[5] = 1 - 2 * (x * x + z * z); out[6] = 2 * (y * z + x * w); out[7] = 0;
  out[8] = 2 * (x * z + y * w); out[9] = 2 * (y * z - x * w); out[10] = 1 - 2 * (x * x + y * y); out[11] = 0;
  out[12] = p[0]; out[13] = p[1]; out[14] = p[2]; out[15] = 1;
  return out;
}

// ---------------------------------------------------------------- the model
const DARK = [0.05, 0.05, 0.06], GLASS = [0.1, 0.15, 0.19], STEEL = [0.32, 0.33, 0.35], GUNM = [0.13, 0.13, 0.14], PLATE = [0.27, 0.28, 0.29];
const SKIN = [[0.86, 0.68, 0.55], [0.6, 0.42, 0.3], [0.42, 0.29, 0.2], [0.95, 0.8, 0.68]];
const SHIRTS = [[0.7, 0.2, 0.2], [0.2, 0.4, 0.75], [0.85, 0.75, 0.3], [0.3, 0.6, 0.35], [0.85, 0.85, 0.85], [0.55, 0.3, 0.6]];
const backOut = (t) => { t = clamp(t, 0, 1); const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

// rotor sizes per rotor tier: [blades, radius, hub height]
// a small quadcopter (spotter or armed): body, four arms and rotors, a camera ball, a gun if it's armed
export function droneParts(P, p, yaw, t, armed, spin = true, flash = 0) {
  const c = Math.cos(yaw), s = Math.sin(yaw), W = (lx, ly, lz) => [p[0] + lx * c + lz * s, p[1] + ly, p[2] - lx * s + lz * c];
  P(W(0, 0, 0), [0, yaw, 0], [0.5, 0.16, 0.62], [0.16, 0.17, 0.18], { mat: 'poly', shape: 0.06 });
  for (const [ax, az] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    P(W(ax * 0.22, 0.02, az * 0.24), [0, yaw + Math.atan2(ax, az), 0], [0.06, 0.05, 0.42], [0.12, 0.12, 0.13], { mat: 'poly' });
    P(W(ax * 0.38, 0.08, az * 0.4), [0, 0, 0], [0.07, 0.08, 0.07], [0.1, 0.1, 0.1], { shape: 'cylY' });
    P(W(ax * 0.38, 0.13, az * 0.4), [0, spin ? t * 50 + ax : ax, 0], spin ? [0.46, 0.01, 0.46] : [0.44, 0.015, 0.05], [0.2, 0.2, 0.2], spin ? { shape: 'cylY', alpha: 0.35 } : {});
  }
  P(W(0, -0.12, -0.22), [0, 0, 0], [0.13, 0.13, 0.13], [0.05, 0.05, 0.07], { mat: 'glass', shape: 'sphere' });
  if (armed) {
    P(W(0, -0.16, 0.02), [0, yaw, 0], [0.08, 0.08, 0.5], [0.12, 0.12, 0.12], { mat: 'metal', shape: 'cyl' });
    if (flash > 0) P(W(0, -0.16, -0.3), [0, 0, 0], [0.2, 0.2, 0.2], [1, 0.8, 0.4], { em: 1, shape: 'sphere', alpha: 0.85 });
  }
  P(W(0, 0.1, 0.3), [0, 0, 0], [0.05, 0.05, 0.05], [0.2, 1, 0.3], { em: (t * 2) % 1 < 0.3 ? 1 : 0.1, shape: 'sphere' });
}
export const ROTOR = [[4, 6.4, 2.25], [5, 7.1, 2.25], [4, 6.2, 2.1], [5, 7.3, 2.3]];

// ---- airframes: where the upgrades bolt on to each one ([x scale, y shift, z shift] per slot), the rotor hubs
// ([y, z, size, blades or 0 for the tier's]), the tail rotor, the seats, and the collision shapes
export const AIRFRAMES = {
  warhorse: { hubs: [[null, 0.3, 1, 0]], tail: [0.3, 2.0, 8.2, 1], cam: 1, off: {} },
  hornet: {
    hubs: [[1.3, -0.45, 0.72, 5]], tail: [0.22, 0.75, 4.6, 0.62], cam: 0.8,
    off: { gun: [1, 0.2, 1.3], rockets: [0.68, -0.05, -0.35], bombs: [0.7, 0.25, -0.5], armor: [0.72, -0.1, 0.4], engine: [0.55, -0.6, -1.35], door: [1.4, -0.35, -0.55],
      fuel: [0.72, 0.1, -0.4], winch: [0.78, -0.4, -0.4], flir: [1, 0.25, 1.3], speaker: [0.68, -0.45, 0], skids: [0.8, 0, -0.3], light: [1, 0.25, 1.3], drops: [0.7, 0, -0.4], radio: [1, -0.6, -0.6], racks: [0.68, -0.05, -0.35], nvg: [1, 0.2, 1.3], flares: [0.6, 0.15, -1.2], beacon: [0.6, -0.2, -1.0], drone: [0.6, -0.65, -2.0], suppress: [0.6, -0.85, -1.9], repair: [0.7, 0, 0], ammo: [1, 0.2, 1.3] },
  },
  reaper: {
    hubs: [[1.95, -0.6, 1.0, 4]], tail: [0.28, 1.5, 6.75, 1], cam: 1.08,
    off: { gun: [1, 0.05, -0.75], rockets: [1.05, 0.12, -0.75], bombs: [0.8, 0.15, -0.6], armor: [0.55, 0, -0.5], engine: [1.5, -0.62, -1.4], flir: [1, 0.1, -1.5],
      speaker: [0.75, -0.3, 0], skids: [0.95, 0, 0], light: [1, 0.05, -1.4], turret: [1, 0.1, -0.5], drops: [0.85, 0.3, 0], radio: [1, -0.15, 0.9], fuel: [1.05, 0.3, -0.6], racks: [1.05, 0.12, -0.75], nvg: [1, 0.05, -0.75], flares: [1, 0.1, 0], beacon: [1, -0.2, 0], drone: [1, -0.6, 0], suppress: [0.8, -0.4, -2.1], repair: [0.55, 0.3, -1], ammo: [1, 0.05, -0.75] },
  },
  kestrel: {
    hubs: [[2.6, -0.2, 1.12, 5]], tail: [0.32, 2.3, 10.05, 1.05], cam: 1.3,
    off: { gun: [1, 0.15, -1.4], rockets: [1.15, -0.1, -0.2], bombs: [1.1, -0.05, 0], armor: [1.12, 0, -0.3], engine: [1.15, 0.15, -0.6], door: [1.13, 0, -0.9], fuel: [1.15, 0.05, 0],
      cabin: [1.13, 0, 0], winch: [1.13, 0.1, -0.5], flir: [1, 0.1, -1.4], speaker: [1.1, 0.1, -0.8], skids: [1.0, 0.1, 0], light: [1, 0.12, -1.4], medbay: [1.13, 0, -0.5], drops: [1.1, 0, 0],
      radio: [1, -0.15, 2.6], racks: [1.15, -0.1, -0.2], nvg: [1, 0.12, -1.4], flares: [1, 0.2, 2.3], beacon: [1, 0.2, 2.3], drone: [1, -0.25, 2.8], suppress: [1.1, 0.2, -0.5], repair: [1.13, 0, -0.3], ammo: [1, 0.15, -1.4] },
  },
  viper: {
    hubs: [[1.75, -0.6, 1.0, 2]], tail: [0.25, 1.3, 6.9, 0.85], cam: 0.95,
    off: { gun: [1, 0.1, -1.6], rockets: [0.95, 0.2, -1.2], bombs: [0.75, 0.2, -1.0], armor: [0.5, 0, -0.5], engine: [1.0, -0.6, -1.2], flir: [1, 0.1, -1.6], speaker: [0.75, -0.3, 0],
      skids: [0.78, 0, 0], light: [1, 0.1, -1.5], drops: [0.85, 0.3, 0], radio: [1, -0.3, 0.6], fuel: [0.95, 0.3, -0.6], racks: [0.95, 0.2, -1.2], nvg: [1, 0.1, -1.6], flares: [0.9, 0.05, -0.2],
      beacon: [0.9, -0.3, 0], drone: [0.6, -0.6, -0.3], suppress: [0.7, -0.5, -2.1], repair: [0.45, 0.3, -1], ammo: [1, 0.1, -1.6] },
  },
  huey: {
    hubs: [[2.3, -0.15, 1.1, 2]], tail: [-0.3, 1.62, 8.3, 0.85], cam: 1,
    off: { gun: [1, 0.05, -0.3], door: [1.05, 0, -0.3], cabin: [1.05, 0, -0.2], winch: [1.05, 0, -0.3], medbay: [1.05, 0, -0.3], fuel: [1.05, 0, 0], armor: [1.05, 0, -0.2],
      rockets: [1.05, 0, -0.2], racks: [1.05, 0, -0.2], bombs: [1.05, 0, -0.2], flir: [1, 0.05, -0.3], light: [1, 0.05, -0.3], nvg: [1, 0.05, -0.3], ammo: [1, 0.05, -0.3], skids: [1.02, 0, -0.2], engine: [0.95, -0.05, -0.4] },
  },
  seaking: {
    hubs: [[2.85, -0.4, 1.16, 5]], tail: [-0.34, 2.45, 10.45, 1.0], cam: 1.35,
    off: { gun: [1, 0.2, -2.3], rockets: [1.2, -0.05, -0.6], bombs: [1.15, -0.05, -0.4], armor: [1.18, 0.05, -0.6], engine: [1.15, 0.35, -1.2], door: [1.18, 0.05, -1.4], fuel: [1.2, 0.05, -0.4],
      cabin: [1.18, 0, -0.6], winch: [1.18, 0.2, -1.2], flir: [1, 0.2, -2.3], skids: [1.05, 0.1, -0.3], light: [1, 0.2, -2.3], medbay: [1.18, 0, -0.8], drops: [1.15, 0, -0.4],
      radio: [1, 0, 2.8], racks: [1.2, -0.05, -0.6], nvg: [1, 0.2, -2.3], suppress: [1.15, 0.3, -0.8], repair: [1.18, 0, -0.6], ammo: [1, 0.2, -2.3], pods: [1.2, -0.05, -0.6], sniper: [1.18, 0.05, -1.4] },
  },
  osprey: {
    hubs: [], tail: null, cam: 1.6,
    off: { gun: [1, 0.15, -3.4], rockets: [1.15, 0.05, -0.4], bombs: [1.15, 0.0, -0.4], armor: [1.1, 0.05, -0.6], engine: [1.1, 0.2, -1.0], door: [1.1, 0.05, -2.6], fuel: [1.15, 0.05, -0.3],
      cabin: [1.1, 0, -0.6], winch: [1.1, 0.2, -2.6], flir: [1, 0.15, -3.4], skids: [1.1, 0.1, -0.2], light: [1, 0.15, -3.4], medbay: [1.1, 0, -0.8], drops: [1.1, 0, -0.4],
      radio: [1, 0.1, 2.0], racks: [1.15, 0.05, -0.4], nvg: [1, 0.15, -3.4], suppress: [1.1, 0.3, -0.8], repair: [1.1, 0, -0.6], ammo: [1, 0.15, -3.4], pods: [1.15, 0.05, -0.4], sniper: [1.1, 0.05, -2.6] },
  },
  harrier: {
    hubs: [], tail: null, cam: 1.0,
    off: { gun: [0.6, 0.15, 0.4], rockets: [1.35, 0.95, 0.2], bombs: [0.7, 0.0, 0.4], armor: [0.7, 0.05, -0.6], engine: [0.75, -0.9, -1.0], fuel: [1.25, 0.95, 0.2],
      flir: [1, 0.3, -2.6], light: [1, 0.3, -2.6], skids: [0.8, 0, 0], drops: [0.7, 0, 0], radio: [1, -0.6, 1.0], racks: [1.35, 0.95, 0.2], nvg: [1, 0.3, -2.6], suppress: [0.7, -0.2, -0.5],
      repair: [0.7, 0, -0.5], ammo: [0.6, 0.15, 0.4], pods: [1.35, 0.95, 0.2] },
  },
  alligator: {
    hubs: [[2.05, -0.55, 1.0, 3]], coax: true, tail: null, cam: 1.05,
    off: { gun: [1, 0.1, -0.9], rockets: [1.1, 0.15, -0.6], bombs: [0.85, 0.15, -0.6], armor: [0.75, 0, -0.5], engine: [1.3, -0.55, -1.2], flir: [1, 0.25, -1.6],
      skids: [0.95, 0, 0], light: [1, 0.1, -1.5], drops: [0.85, 0.3, 0], radio: [1, -0.2, 0.9], fuel: [1.1, 0.3, -0.6], racks: [1.1, 0.15, -0.6], nvg: [1, 0.1, -0.9], suppress: [0.75, -0.3, -1.5],
      repair: [0.6, 0.2, -1], ammo: [1, 0.1, -0.9], pods: [1.1, 0.15, -0.6] },
  },
  skycrane: {
    hubs: [[2.45, 0.2, 1.22, 6]], tail: [0.32, 2.25, 9.65, 1.05], cam: 1.4,
    off: { gun: [1, 0.35, -2.1], rockets: [1.15, 0.05, -0.2], bombs: [1.0, 0.1, 0], armor: [1.0, 0.05, -0.2], engine: [1.1, 0.25, -0.4], door: [1.05, -0.1, 0.2], fuel: [1.2, 0.05, 0],
      cabin: [1.05, -0.1, 0.2], winch: [1.05, 0.1, 0.0], flir: [1, 0.25, -2.7], skids: [1.25, 0, 0], light: [1, 0.25, -2.7], medbay: [1.05, -0.1, 0.2], drops: [1.0, 0, 0],
      radio: [1, 0.5, 2.8], racks: [1.15, 0.05, -0.2], nvg: [1, 0.25, -2.7], suppress: [1.0, 0.3, -0.4], repair: [1.05, 0, 0], ammo: [1, 0.25, -2.7], sniper: [1.05, -0.1, 0.2] },
  },
  warthog: {
    hubs: [], tail: null, cam: 1.15,
    off: { gun: [0.6, 0.3, -2.6], rockets: [1.7, 0.1, 0.2], bombs: [1.0, -0.15, 0.3], armor: [0.7, 0.05, -1.0], engine: [1.1, -0.2, 1.5], fuel: [1.6, 0.1, 0.2],
      flir: [1, 0.35, -2.6], light: [1, 0.35, -2.6], drops: [0.7, 0, 0], radio: [1, -0.5, 1.5], racks: [1.7, 0.1, 0.2], nvg: [1, 0.35, -2.6], suppress: [0.7, -0.2, -0.5],
      repair: [0.7, 0, -0.5], ammo: [0.6, 0.3, -2.6], pods: [1.7, 0.1, 0.2] },
  },
  spectre: {
    hubs: [], tail: null, cam: 1.9,
    off: { gun: [1, 0.2, -5.6], bombs: [1.3, -0.2, -0.5], armor: [1.4, 0.05, -1.0], engine: [1.3, 0.6, -1.0], door: [1.4, 0.0, -2.0], fuel: [1.4, 0.05, -0.5],
      flir: [1, 0.2, -5.6], light: [1, 0.2, -5.6], drops: [1.2, 0, 1.5], radio: [1, 1.6, 2.0], racks: [1.4, 0, 0], nvg: [1, 0.2, -5.6], suppress: [1.3, 0.3, -1.0],
      repair: [1.4, 0, -0.6], ammo: [1, 0.2, -5.6] },
  },
  mule: {
    hubs: [[2.4, -5.2, 1.08, 3], [3.15, 4.8, 1.08, 3]], tail: null, cam: 1.5,
    off: { gun: [1, 0.25, -3.65], bombs: [1.2, 0.05, 0], armor: [1.28, 0.1, 0], engine: [2.95, 0.25, 2.6], door: [1.25, 0.1, -3.4], fuel: [1.3, 0.2, 0],
      cabin: [1.3, 0, 0], winch: [1.18, 0.4, -2.2], flir: [1, 0.25, -3.6], speaker: [1.2, 0.5, -3], skids: [1.08, 0, 0.3], light: [1, 0.3, -3.8], turret: [1, 0.05, 0], medbay: [1.25, 0.1, -1], drops: [1.0, 0.25, 0], radio: [1, 2.0, 1.2], racks: [1.2, 0.05, 0], nvg: [1, 0.25, -3.65], flares: [3.2, 0.5, 2.5], beacon: [2.8, 0.2, 1.0], drone: [1, 2.2, -1.2], suppress: [1.2, 1.5, 2.2], repair: [1.36, 0.3, 0], ammo: [1, 0.25, -3.65] },
  },
};
// where an upgrade's point (in the Warhorse's frame) ends up on another airframe (gun muzzles, pods, doors...)
export function mountAt(kind, slot, p) { const of = (AIRFRAMES[kind] || AIRFRAMES.warhorse).off[slot]; return of ? [p[0] * of[0], p[1] + of[1], p[2] + of[2]] : p; }
// st: { rotorA, tailA, rpm, spin, t, install: {slot: 0..1}, riders, rockets (left), rocketMax, bombs, bombMax,
//       boost (0..1), doorAim: [[yaw, pitch], [yaw, pitch]], flash }
export function chopperParts(eq, paint, st, H, kind = 'warhorse') {
  const out = [], loc = mat4();
  const AF = AIRFRAMES[kind] || AIRFRAMES.warhorse;
  const body = paint.body, trim = paint.trim, pm = paint.mat || 'paint', glow = paint.glow, camo = paint.camo || 0;
  // some kit is drawn a bit smaller than it was, so it doesn't swamp the helicopter: scaled in towards where it bolts on
  // (the gun towards its turret, each pod towards its pylon)
  let PV = null;
  const add = (slot, p, r, s, col, o = {}) => {
    let k = 1;
    const sh = !o.full && (slot === 'gun' ? 0.78 : slot === 'rockets' && PV ? 0.82 : 0);
    if (sh) {
      const pv = slot === 'gun' ? [0, -0.85, -3.0] : PV;
      p = [pv[0] + (p[0] - pv[0]) * sh, pv[1] + (p[1] - pv[1]) * sh, pv[2] + (p[2] - pv[2]) * sh];
      s = [s[0] * sh, s[1] * sh, s[2] * sh];
    }
    const of = slot && AF.off[slot];
    if (of) p = [p[0] * of[0], p[1] + of[1], p[2] + of[2]];
    if (slot && st.install && st.install[slot] != null && st.install[slot] < 1) {
      const t = st.install[slot];
      k = backOut(t);
      p = [p[0], p[1] + (1 - clamp(t * 1.4, 0, 1)) * 1.6, p[2]];
    }
    if (k <= 0.001) return;
    const sc = [s[0] * k, s[1] * k, s[2] * k];
    compose(loc, p, r, sc);
    const m = new Float32Array(16);
    mul(m, H, loc);
    out.push({ model: m, scale: sc, color: col, emissive: o.em || 0, shape: o.shape, mat: o.mat, alpha: o.alpha, edges: o.edges ?? 0, tex: o.tex ?? (col === body || col === trim ? (camo ? 80 + camo : 65) : 0) });
  };
  const B = (p, s, col = body, o = {}) => add(null, p, o.r || [0, 0, 0], s, col, { mat: pm, shape: 0.06, ...o });
  // a lofted body part (hulls.js), drawn at scale 1
  const M = (name, col = body, o = {}) => { const gl = col === GLASS; return add(null, o.p || [0, 0, 0], o.r || [0, 0, 0], [1, 1, 1], gl && paint.glass ? paint.glass : col, { shape: name, mat: gl ? 'glass' : pm, tex: gl ? 0 : col === body || col === trim ? (camo ? 80 + camo : 68) : 0, ...o }); };

  if (kind === 'warhorse') {
    // ---- fuselage: one smooth skin from the nose to the tail, the engine cowling on top, the glass
    M('h_warhorse'); M('h_warhorse_cowl'); M('g_warhorse', GLASS);
    // sliding doors: seams, a rail along the top, a handle
    for (const x of [-1, 1]) {
      for (const z of [0.0, 1.45]) B([x * 1.15, -0.05, z], [0.03, 1.3, 0.035], DARK, { shape: undefined, mat: 'metal' });
      B([x * 1.1, 0.74, 0.75], [0.05, 0.05, 1.9], GUNM, { shape: undefined, mat: 'metal' });
      B([x * 1.12, -0.78, 0.72], [0.03, 0.035, 1.42], DARK, { shape: undefined, mat: 'metal' });
      B([x * 1.17, 0.05, 1.3], [0.04, 0.05, 0.22], STEEL, { mat: 'steel' });
      for (const z of [-1.55, -0.2]) B([x * 1.15, -0.1, z], [0.03, 1.1, 0.035], DARK, { shape: undefined, mat: 'metal' });   // crew door
    }
    // tail: a swept fin, the tail plane, the tail rotor
    B([0, 1.38, 7.86], [0.13, 2.05, 1.05], body, { r: [-0.38, 0, 0], shape: 0.05, tex: 65 });
    B([0, 0.56, 7.0], [2.6, 0.08, 0.58], trim, { shape: 0.035, tex: 65 });
    B([0.2, 2.0, 8.2], [0.22, 0.22, 0.22], STEEL, { shape: 'sphere', mat: 'steel' });
    for (let i = 0; i < 2; i++) B([0.3, 2.0, 8.2], [0.06, 1.7, 0.2], DARK, { r: [st.tailA + i * Math.PI / 2, 0, 0], shape: undefined, mat: 'metal' });
    if (st.rpm > 0.4) B([0.31, 2.0, 8.2], [1.72, 1.72, 0.03], [0.2, 0.2, 0.2], { shape: 'cyl', r: [0, Math.PI / 2, 0], alpha: 0.12 * st.rpm });
    // skids: two long tubes curled up at the front, on two bowed cross tubes
    for (const x of [-1.25, 1.25]) {
      B([x, -1.85, 0.25], [0.13, 0.13, 4.8], GUNM, { shape: 'cyl', mat: 'metal' });
      B([x, -1.73, -2.3], [0.13, 0.13, 0.55], GUNM, { shape: 'cyl', mat: 'metal', r: [-0.7, 0, 0] });
      for (const z of [-1.0, 1.4]) {
        B([x * 0.93, -1.55, z], [0.11, 0.62, 0.11], GUNM, { r: [0, 0, x > 0 ? 0.32 : -0.32], shape: 'cylY', mat: 'metal' });
        B([x * 0.62, -1.19, z], [0.55, 0.1, 0.1], GUNM, { r: [0, 0, x > 0 ? -0.18 : 0.18], shape: 0.04, mat: 'metal' });
      }
    }
    // ---- the little things that make it look real
    const BLINK = (st.t * 1.1) % 1 < 0.12 ? 1 : 0.08;
    B([0, -0.28, -2.82], [1.5, 0.36, 0.42], [0.08, 0.08, 0.09], { shape: 0.05, mat: 'poly' });              // instrument panel
    for (const x of [-0.42, 0, 0.42]) B([x, -0.1, -3.0], [0.3, 0.2, 0.03], x ? [0.25, 0.9, 0.45] : [0.95, 0.65, 0.2], { em: 0.75, r: [0.5, 0, 0] });
    B([0, 1.0, -2.7], [0.05, 0.6, 0.05], GUNM, { r: [-0.5, 0, 0], mat: 'metal' });                           // wire cutters
    B([0, -1.15, -3.25], [0.05, 0.5, 0.05], GUNM, { r: [0.5, 0, 0], mat: 'metal' });
    for (const x of [-0.42, 0.42]) {
      B([x, -0.36, -4.05], [0.035, 0.035, 0.75], STEEL, { shape: 'cyl', mat: 'steel' });                     // pitot tubes
      B([x, -0.36, -4.43], [0.06, 0.06, 0.05], [0.85, 0.15, 0.1], { shape: 'cyl' });
    }
    for (const x of [-1, 1]) {
      // engine air intakes with grilles either side of the cowling
      B([x * 0.8, 1.42, -0.25], [0.12, 0.5, 0.75], [0.03, 0.03, 0.035], { shape: 0.04 });
      for (let k = 0; k < 4; k++) B([x * 0.87, 1.24 + k * 0.12, -0.25], [0.03, 0.03, 0.72], GUNM, { mat: 'metal' });
      // soot behind the exhausts, steps and handles by the doors
      B([x * 1.19, -1.28, 0.75], [0.28, 0.05, 0.55], GUNM, { mat: 'metal' });
      B([x * 1.2, 0.05, 0.05], [0.04, 0.06, 0.35], STEEL, { mat: 'steel' });
      B([x * 1.17, -0.75, -1.9], [0.03, 0.05, 0.55], [0.92, 0.9, 0.2], { em: glow ? 0.4 : 0 });               // a warning stripe
      B([x * 1.3, 0.52, 7.0], [0.06, 0.42, 0.6], trim, { shape: 0.03 });                                      // stabiliser end plates
      B([x * 1.12, 0.25, -1.05], [0.12, 0.1, 0.18], DARK, { mat: 'metal' });                                  // mirror arms
      B([x * 1.24, 0.25, -1.1], [0.05, 0.24, 0.18], [0.5, 0.55, 0.6], { mat: 'steel' });
    }
    B([0, 0.88, 4.6], [0.2, 0.1, 3.6], body, { shape: 0.04, tex: 65 });                                       // drive shaft cover
    B([0, 1.0, 4.0], [0.04, 0.42, 0.3], DARK, { r: [-0.4, 0, 0] });                                         // blade aerials
    B([0, -1.32, -1.3], [0.04, 0.32, 0.26], DARK, { r: [0.4, 0, 0] });
    B([0, 1.72, 1.95], [0.14, 0.1, 0.14], [1, 0.12, 0.08], { em: BLINK, shape: 'sphere' });                 // anti-collision beacons
    B([0, -1.3, 1.0], [0.14, 0.1, 0.14], [1, 0.12, 0.08], { em: BLINK, shape: 'sphere' });
    B([0, -0.05, 7.7], [0.08, 0.45, 0.35], GUNM, { r: [0.5, 0, 0], mat: 'metal' });                          // tail skid
    for (const x of [-0.42, 0.42]) B([x, 1.615, 0.95], [0.5, 0.01, 0.3], [0.85, 0.85, 0.8], { alpha: 0.6, shape: undefined }); // NO STEP
    // nav lights: red on the left, green on the right, a white strobe on the tail
    const wings = eq.rockets || eq.bombs || eq.fuel === 2 || eq.pods, wingX = wings ? (eq.racks ? 2.75 : 2.35) : 1.2;
    B([-wingX, -0.33, 0.5], [0.12, 0.12, 0.12], [1, 0.1, 0.05], { em: 1, shape: 'sphere' });
    B([wingX, -0.33, 0.5], [0.12, 0.12, 0.12], [0.1, 1, 0.2], { em: 1, shape: 'sphere' });
    B([0, 2.45, 8.25], [0.12, 0.12, 0.12], [1, 1, 1], { em: (st.t * 1.2) % 1 < 0.08 ? 1 : 0.1, shape: 'sphere' });
    // stub wings carry pods and bombs
    if (wings) add(eq.rockets ? 'rockets' : eq.bombs ? 'bombs' : 'fuel', [0, -0.35, 0.5], [0, 0, 0], [eq.racks && (eq.rockets || eq.bombs) ? 5.4 : 4.5, 0.16, 0.9], trim, { mat: pm, shape: 0.05, tex: 65 });

    // ---- paint patterns
    if (paint.stripe) {
      for (const z of [4.4, 5.6, 6.8]) B([0, z < 5 ? 0.45 : 0.5, z], [z < 5 ? 0.92 : 0.62, z < 5 ? 0.92 : 0.62, 0.32], paint.stripe, { shape: 0.2, em: glow ? 0.8 : 0 });
      for (const x of [-1.17, 1.17]) B([x, -0.62, 0.2], [0.03, 0.16, 3.6], paint.stripe, { shape: undefined, em: glow ? 0.9 : 0 });
    }
  } else hullFor(kind, B, add, st, eq, paint, M);
  // ---- nose art, tail markings, the tail number
  const nose = paint.nose && paint.nose !== 'none' ? paint.nose : null, ta = paint.tailArt && paint.tailArt !== 'none' ? paint.tailArt : null;
  if (nose) { DECAL_COLS[nose].forEach((c, i) => M(`d_${kind}_${nose}_${i}`, c, { mat: 'paint', tex: 0 })); if (nose === 'shark') M(`d_${kind}_shark_3`, DECAL_COLS.shark[1], { mat: 'paint', tex: 0 }); }
  if (ta === 'number') { const n = String(paint.num ?? 7).padStart(2, '0').slice(-2); M(`d_${kind}_num0_${n[0]}`, DECAL_COLS.number[0], { mat: 'paint', tex: 0 }); M(`d_${kind}_num1_${n[1]}`, DECAL_COLS.number[0], { mat: 'paint', tex: 0 }); }
  else if (ta) DECAL_COLS[ta].forEach((c, i) => M(`d_${kind}_${ta}_${i}`, c, { mat: 'paint', tex: 0 }));

  // ---- engine
  const en = eq.engine;
  const exS = [0.38, 0.5, 0.5, 0.6, 0.6][en], exL = [0.5, 0.8, 0.8, 1.0, 1.0][en];
  const hot = en >= 1 ? 0.35 + (st.rpm || 0) * 0.3 : 0;
  for (const x of [-0.55, 0.55]) {
    add('engine', [x, 1.45, 2.1], [0, 0, 0], [exS, exS, exL], GUNM, { mat: 'metal', shape: 'cyl' });
    if (en >= 1) add('engine', [x, 1.45, 2.1 + exL / 2 + 0.01], [0, 0, 0], [exS * 0.7, exS * 0.7, 0.03], [1, 0.45, 0.12], { em: hot, shape: 'cyl' });
  }
  if (en >= 2 && en < 4) for (const x of [-1.0, 1.0]) {
    add('engine', [x, 1.32, 0.9], [0, 0, 0], [0.72, 0.72, 2.3], body, { mat: pm, shape: 'cyl' });
    add('engine', [x, 1.32, -0.28], [0, 0, 0], [0.6, 0.6, 0.06], DARK, { shape: 'cyl' });
    add('engine', [x, 1.32, 2.1], [0, 0, 0], [0.55, 0.55, 0.3], GUNM, { mat: 'metal', shape: 'cyl' });
  }
  if (en === 3) for (const x of [-1.0, 1.0]) {
    const b = st.boost || 0;
    add('engine', [x, 1.32, 2.35], [0, 0, 0], [0.62, 0.62, 0.22], STEEL, { mat: 'steel', shape: 'cyl' });
    add('engine', [x, 1.32, 2.47], [0, 0, 0], [0.42, 0.42, 0.03], [1, 0.5, 0.15], { em: 0.4 + b * 0.6, shape: 'cyl' });
    if (b > 0.05) add(null, [x, 1.32, 2.5 + b * 0.8], [0, 0, 0], [0.4, 0.4, b * 1.6], [1, 0.6, 0.3], { em: 0.6, shape: 'cyl', alpha: 0.25 });
  }

  if (en === 4) for (const x of [-1.0, 1.0]) {
    // UPRATED ENGINES: two big turboshaft nacelles with intake screens and twin exhausts
    add('engine', [x, 1.34, 0.85], [0, 0, 0], [0.86, 0.86, 2.7], body, { mat: pm, shape: { cap: [0.43, 0.36] }, tex: 65 });
    add('engine', [x, 1.34, -0.47], [0, 0, 0], [0.7, 0.7, 0.05], [0.05, 0.05, 0.06], { shape: 'cyl' });
    for (let k = 0; k < 3; k++) add('engine', [x, 1.34, -0.49], [0, 0, k * 1.05], [0.66, 0.03, 0.03], STEEL, { mat: 'steel' });
    add('engine', [x, 1.34, 0.85], [0, 0, 0], [0.88, 0.88, 0.06], GUNM, { mat: 'metal', shape: 'cyl' });
    for (const dy of [-0.14, 0.14]) {
      add('engine', [x * 1.08, 1.34 + dy, 2.3], [0, 0, 0], [0.26, 0.26, 0.4], GUNM, { mat: 'metal', shape: 'cyl' });
      add('engine', [x * 1.08, 1.34 + dy, 2.5], [0, 0, 0], [0.19, 0.19, 0.02], [1, 0.45, 0.12], { em: hot + (st.boost || 0) * 0.5, shape: 'cyl' });
    }
  }

  // ---- rotor
  const [nb0, R0, hy0] = ROTOR[eq.rotor || 0];
  const TIP = paint.tips || paint.stripe || [0.9, 0.8, 0.2];
  const coax = (eq.rotor === 2 || AF.coax) && kind !== 'mule', comp = eq.rotor === 3;
  let nb = nb0, R = R0, hz = 0.3;
  const rotorAt = (y, a0, dir) => {
    add('rotor', [0, y, hz], [0, a0 * dir, 0], [0.75, 0.24, 0.75], GUNM, { mat: 'metal', shape: 'cylY' });
    add('rotor', [0, y + 0.17, hz], [0, 0, 0], [0.48, 0.24, 0.48], STEEL, { mat: 'steel', shape: 'sphere' });   // hub cap
    add('rotor', [0, y - 0.3, hz], [0, a0 * dir, 0], [1.0, 0.08, 1.0], STEEL, { mat: 'steel', shape: 'cylY' });  // swashplate
    for (let i = 0; i < nb; i++) {
      const a = a0 * dir + (i * Math.PI * 2) / nb;
      add('rotor', [-Math.sin(a) * 0.62, y + 0.04, hz - Math.cos(a) * 0.62], [0, a, 0], [0.26, 0.16, 0.6], GUNM, { mat: 'metal', shape: 0.05 });   // blade grip
      add('rotor', [-Math.sin(a + 0.4) * 0.42, y - 0.13, hz - Math.cos(a + 0.4) * 0.42], [0, 0, 0], [0.04, 0.32, 0.04], STEEL, { mat: 'steel' }); // pitch link
      const cw = comp ? 0.6 : 0.42;
      add('rotor', [-Math.sin(a) * R / 2, y + 0.04, hz - Math.cos(a) * R / 2], [0.0, a, 0.05], [cw, 0.07, R], DARK, { mat: 'metal', shape: 0.03 });
      if (comp) {
        // composite: a wider blade with a swept, anhedral tip and a steel leading edge
        const tx = -Math.sin(a) * (R + 0.35) - Math.cos(a) * 0.12, tz = hz - Math.cos(a) * (R + 0.35) + Math.sin(a) * 0.12;
        add('rotor', [tx, y + 0.0, tz], [0, a + 0.35, -0.12], [0.42, 0.06, 0.8], DARK, { mat: 'metal', shape: 0.025 });
        add('rotor', [-Math.sin(a) * R / 2 - Math.cos(a) * 0.29, y + 0.05, hz - Math.cos(a) * R / 2 + Math.sin(a) * 0.29], [0, a, 0], [0.05, 0.075, R * 0.96], STEEL, { mat: 'steel' });
        add('rotor', [tx, y + 0.01, tz], [0, a + 0.35, -0.12], [0.43, 0.065, 0.3], TIP, { shape: undefined, em: glow ? 0.6 : 0 });
      } else {
        add('rotor', [-Math.sin(a) * (R - 0.2), y + 0.05, hz - Math.cos(a) * (R - 0.2)], [0, a, 0], [0.43, 0.075, 0.4], TIP, { shape: undefined, em: glow ? 0.6 : 0 });
        if (paint.tips2) add('rotor', [-Math.sin(a) * (R - 0.55), y + 0.05, hz - Math.cos(a) * (R - 0.55)], [0, a, 0], [0.435, 0.078, 0.3], paint.tips2, { shape: undefined });
      }
    }
    if (st.rpm > 0.35) add(null, [0, y + 0.04, hz], [0, 0, 0], [R * 2 + (comp ? 0.7 : 0), 0.03, R * 2 + (comp ? 0.7 : 0)], [0.15, 0.15, 0.15], { shape: 'cylY', alpha: 0.1 * st.rpm });
  };
  AF.hubs.forEach(([hy1, z1, rs, nbl], hi) => {
    const hy = hy1 ?? hy0;
    hz = z1; R = R0 * rs; nb = nbl || nb0;
    add(null, [0, hy - 0.4, hz], [0, 0, 0], [0.3, coax ? 1.3 : 0.9, 0.3], STEEL, { mat: 'steel', shape: 'cylY' });
    rotorAt(hy, st.rotorA + hi * 0.5, hi ? -1 : 1);
    if (coax) rotorAt(hy + 0.6, st.rotorA, -1);
  });

  // ---- nose gun
  const g = eq.gun, spin = st.spin || 0;
  add('gun', [0, -1.0, -3.0], [0, 0, 0], [0.7, 0.6, 0.7], trim, { mat: 'metal', shape: 'sphere' });
  add('gun', [0, -0.78, -3.0], [0, 0, 0], [0.42, 0.22, 0.42], GUNM, { mat: 'metal', shape: 'cylY' });        // turret ring
  if (g <= 3) {
    // the ammo belt: brass links running from a box in the belly to the gun
    const BR = [0.78, 0.6, 0.24], bx = g === 2 ? 0.66 : 0.3;
    add('gun', [bx + 0.1, -1.05, -2.35], [0, 0, 0], [0.42, 0.42, 0.55], [0.2, 0.22, 0.17], { mat: 'metal', shape: 0.04 });
    for (let k = 0; k < 6; k++) { const f = k / 5; add('gun', [bx + 0.1 - f * 0.12, -1.0 - Math.sin(f * 3.1) * 0.14, -2.62 - f * 0.62], [0.4, 0, 0], [0.16, 0.05, 0.11], BR, { mat: 'brass' }); }
  }
  const barrelsAt = (x) => {
    // cooled barrels: a vented jacket round the barrels (or a clamp ring on the spinning ones)
    if (eq.cooling) {
      if (g === 1 || g === 2) add('gun', [x, -1.05, -4.45], [0, 0, spin], [0.34, 0.34, 0.1], STEEL, { mat: 'steel', shape: 'cyl' });
      else {
        add('gun', [x, -1.05, g === 0 ? -4.0 : -4.1], [0, 0, 0], [g === 0 ? 0.24 : 0.32, g === 0 ? 0.24 : 0.32, 0.95], [0.2, 0.21, 0.22], { mat: 'metal', shape: 'cyl' });
        for (let k = 0; k < 4; k++) add('gun', [x, -1.05, (g === 0 ? -3.7 : -3.8) - k * 0.2], [0, 0, 0], [g === 0 ? 0.25 : 0.33, g === 0 ? 0.25 : 0.33, 0.04], [0.05, 0.05, 0.05], { shape: 'cyl' });
      }
    }
    if (g === 0) {
      add('gun', [x, -1.05, -3.35], [0, 0, 0], [0.32, 0.32, 0.7], GUNM, { mat: 'metal', shape: 0.05 });
      add('gun', [x, -1.05, -4.1], [0, 0, 0], [0.13, 0.13, 1.5], GUNM, { mat: 'metal', shape: 'cyl' });
      add('gun', [x, -1.05, -4.85], [0, 0, 0], [0.2, 0.2, 0.18], GUNM, { mat: 'metal', shape: 'cyl' });
    } else if (g === 5) {
      // GAU-19: three fat .50 barrels spinning in a clamp, a big receiver, a feed chute
      add('gun', [x, -1.05, -3.3], [0, 0, 0], [0.55, 0.5, 0.95], GUNM, { mat: 'metal', shape: 0.08 });
      for (let i = 0; i < 3; i++) {
        const a = spin + (i * Math.PI * 2) / 3;
        add('gun', [x + Math.cos(a) * 0.12, -1.05 + Math.sin(a) * 0.12, -4.2], [0, 0, 0], [0.09, 0.09, 1.7], STEEL, { mat: 'steel', shape: 'cyl' });
      }
      for (const z of [-3.9, -4.6, -5.0]) add('gun', [x, -1.05, z], [0, 0, spin], [0.38, 0.38, 0.08], GUNM, { mat: 'metal', shape: 'cyl' });
      add('gun', [x + 0.4, -0.95, -2.8], [0, 0, 0], [0.18, 0.18, 0.9], [0.2, 0.22, 0.17], { mat: 'metal', shape: 0.04 });
    } else if (g <= 2) {
      add('gun', [x, -1.05, -3.35], [0, 0, 0], [0.4, 0.4, 0.75], GUNM, { mat: 'metal', shape: 0.06 });
      for (let i = 0; i < 6; i++) {
        const a = spin + (i * Math.PI) / 3;
        add('gun', [x + Math.cos(a) * 0.1, -1.05 + Math.sin(a) * 0.1, -4.15], [0, 0, 0], [0.055, 0.055, 1.6], STEEL, { mat: 'steel', shape: 'cyl' });
      }
      for (const z of [-3.85, -4.85]) add('gun', [x, -1.05, z], [0, 0, spin], [0.32, 0.32, 0.07], GUNM, { mat: 'metal', shape: 'cyl' });
    } else {
      // AUTOCANNON: a fat single barrel with a muzzle brake and an ammo drum
      add('gun', [x, -1.05, -3.35], [0, 0, 0], [0.5, 0.5, 0.9], GUNM, { mat: 'metal', shape: 0.08 });
      add('gun', [x + (x < 0 ? -0.42 : 0.45), -1.0, -3.2], [0, 0, 0], [0.42, 0.55, 0.55], trim, { mat: 'metal', shape: 'cyl' });
      add('gun', [x, -1.05, -4.3], [0, 0, 0], [0.2, 0.2, 1.8], [0.1, 0.1, 0.11], { mat: 'metal', shape: 'cyl' });
      add('gun', [x, -1.05, -5.2], [0, 0, 0], [0.32, 0.32, 0.35], GUNM, { mat: 'metal', shape: 0.04 });
      for (const sd of [-1, 1]) add('gun', [x + sd * 0.17, -1.05, -5.2], [0, 0, 0], [0.04, 0.2, 0.22], [0.05, 0.05, 0.05], {});
    }
  };
  if (g === 2 || g === 4) { add('gun', [0, -1.0, -3.2], [0, 0, 0], [g === 4 ? 1.55 : 1.25, 0.3, 0.6], GUNM, { mat: 'metal', shape: 0.06 }); barrelsAt(g === 4 ? -0.52 : -0.42); barrelsAt(g === 4 ? 0.52 : 0.42); } else barrelsAt(0);
  if (st.flash > 0) for (const x of g === 2 ? [-0.42, 0.42] : g === 4 ? [-0.52, 0.52] : [0]) add('gun', [x, -1.05, -5.1], [0, 0, st.t * 40], [0.45, 0.45, 0.6], g >= 3 ? [1, 0.7, 0.3] : [1, 0.8, 0.4], { em: 1, shape: 'sphere', alpha: 0.85 });

  // ---- rockets
  const rk = eq.rockets;
  if (rk === 1 || rk === 2) {
    const xs = rk === 1 ? [-1.75, 1.75] : [-1.35, 1.35, -2.15, 2.15];
    const show = st.rocketMax ? st.rockets / st.rocketMax : 1;
    xs.forEach((x, j) => {
      PV = [x, -0.3, 0.45];
      add('rockets', [x, -0.66, 0.45], [0, 0, 0], [0.58, 0.58, 1.75], trim, { mat: 'metal', shape: 'cyl' });
      add('rockets', [x, -0.66, -0.43], [0, 0, 0], [0.5, 0.5, 0.04], DARK, { shape: 'cyl' });
      add('rockets', [x, -0.66, 0.45], [0, 0, 0], [0.6, 0.6, 0.12], paint.stripe || [0.7, 0.62, 0.2], { shape: 'cyl' });
      add('rockets', [x, -0.66, -0.4], [0, 0, 0], [0.62, 0.62, 0.07], STEEL, { mat: 'steel', shape: 'cyl' });       // front ring
      add('rockets', [x, -0.66, 1.33], [0, 0, 0], [0.5, 0.5, 0.03], [0.04, 0.04, 0.04], { shape: 'cyl' });           // the back, black with soot
      add('rockets', [x, -0.38, 0.45], [0, 0, 0], [0.1, 0.22, 1.0], GUNM, { mat: 'metal', shape: 0.02 });            // pylon
      add('rockets', [x + 0.3, -0.66, 0.8], [0, 0, 0], [0.04, 0.04, 0.4], [0.9, 0.85, 0.2], {});                     // arming tag
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + 0.785;
        if (show <= (j * 4 + i) / (xs.length * 4)) continue;
        add('rockets', [x + Math.cos(a) * 0.15, -0.66 + Math.sin(a) * 0.15, -0.44], [0, 0, 0], [0.1, 0.1, 0.1], [0.85, 0.15, 0.1], { shape: 'sphere' });
      }
    });
  } else if (rk === 4) {
    // APKWS: two long 19-tube pods; the guidance kits show as little glass eyes on the rocket noses
    const show = st.rocketMax ? st.rockets / st.rocketMax : 1;
    for (const x of [-1.75, 1.75]) {
      PV = [x, -0.3, 0.45];
      add('rockets', [x, -0.7, 0.45], [0, 0, 0], [0.72, 0.72, 1.95], trim, { mat: 'metal', shape: 'cyl' });
      add('rockets', [x, -0.7, -0.53], [0, 0, 0], [0.74, 0.74, 0.08], STEEL, { mat: 'steel', shape: 'cyl' });
      add('rockets', [x, -0.7, 1.44], [0, 0, 0], [0.56, 0.56, 0.03], [0.04, 0.04, 0.04], { shape: 'cyl' });
      add('rockets', [x, -0.38, 0.45], [0, 0, 0], [0.1, 0.22, 1.1], GUNM, { mat: 'metal', shape: 0.02 });
      add('rockets', [x, -0.7, 0.45], [0, 0, 0], [0.74, 0.74, 0.1], paint.stripe || [0.75, 0.62, 0.2], { shape: 'cyl' });
      for (let i = 0; i < 7; i++) {
        const a = i * 1.047, r = i === 6 ? 0 : 0.2, cx = x + Math.cos(a) * r, cy = -0.7 + Math.sin(a) * r;
        add('rockets', [cx, cy, -0.56], [0, 0, 0], [0.12, 0.12, 0.03], [0.06, 0.06, 0.06], { shape: 'cyl' });
        if (show > i / 7) { add('rockets', [cx, cy, -0.58], [0, 0, 0], [0.1, 0.1, 0.1], [0.85, 0.85, 0.8], { shape: 'sphere' }); add('rockets', [cx, cy, -0.62], [0, 0, 0], [0.05, 0.05, 0.03], [0.2, 0.25, 0.3], { mat: 'glass', shape: 'sphere' }); }
      }
    }
  } else if (rk === 3) {
    const show = st.rocketMax ? Math.ceil((st.rockets / st.rocketMax) * 4) : 4;
    [[-1.5, 0], [1.5, 1], [-2.15, 2], [2.15, 3]].forEach(([x, i]) => {
      PV = [x, -0.3, 0.45];
      add('rockets', [x, -0.5, 0.5], [0, 0, 0], [0.12, 0.18, 1.7], GUNM, { mat: 'metal', shape: 0.03 });
      if (i >= show) return;
      add('rockets', [x, -0.75, 0.45], [0, 0, 0], [0.24, 0.24, 1.7], [0.82, 0.82, 0.78], { mat: 'paint', shape: 'cyl' });
      add('rockets', [x, -0.75, -0.48], [0, 0, 0], [0.24, 0.24, 0.32], [0.85, 0.12, 0.1], { shape: 'sphere' });
      add('rockets', [x, -0.75, -0.62], [0, 0, 0], [0.11, 0.11, 0.07], [0.1, 0.12, 0.15], { mat: 'glass', shape: 'sphere' });
      for (const r of [0.785, 2.356]) add('rockets', [x, -0.75, -0.15], [0, 0, r], [0.36, 0.03, 0.22], [0.75, 0.75, 0.72], {});
      for (const r of [0, Math.PI / 2]) add('rockets', [x, -0.75, 1.15], [0, 0, r], [0.5, 0.04, 0.3], GUNM, { shape: undefined });
    });
  }

  PV = null;
  // ---- bombs
  if (eq.bombs) {
    const show = st.bombMax ? st.bombs : 4;
    add('bombs', [0, -1.38, 0.4], [0, 0, 0], [1.3, 0.1, 1.8], GUNM, { mat: 'metal', shape: 0.03 });
    [[-0.42, -0.1], [0.42, -0.1], [-0.42, 0.95], [0.42, 0.95]].forEach(([x, z], i) => {
      if (i >= show) return;
      if (eq.bombs === 4) {
        if (i >= 2) return;
        // THERMOBARIC: a big olive-drab fuel-air bomb with yellow bands and a fuse probe on the nose
        add('bombs', [x, -1.75, 0.4], [0, 0, 0], [0.6, 0.6, 1.8], [0.3, 0.33, 0.25], { mat: 'paint', shape: { cap: [0.3, 0.3] } });
        for (const dz of [-0.35, 0.05]) add('bombs', [x, -1.75, 0.4 + dz], [0, 0, 0], [0.62, 0.62, 0.07], [0.95, 0.78, 0.1], { shape: 'cyl' });
        add('bombs', [x, -1.75, -0.6], [0, 0, 0], [0.05, 0.05, 0.35], STEEL, { mat: 'steel', shape: 'cyl' });
        for (const r of [0.785, 2.356]) add('bombs', [x, -1.75, 1.2], [0, 0, r], [0.82, 0.04, 0.32], [0.24, 0.26, 0.2], { mat: 'metal' });
        return;
      }
      if (eq.bombs === 3) {
        // NAPALM: red barrels with hazard bands
        add('bombs', [x, -1.66, z], [0, 0, 0], [0.48, 0.48, 0.9], [0.7, 0.12, 0.08], { mat: 'paint', shape: 'cyl' });
        for (const dz of [-0.25, 0.25]) add('bombs', [x, -1.66, z + dz], [0, 0, 0], [0.5, 0.5, 0.06], [0.1, 0.1, 0.1], { shape: 'cyl' });
        add('bombs', [x, -1.66, z], [0, 0, 0], [0.5, 0.5, 0.18], [1, 0.6, 0.1], { shape: 'cyl', em: 0.3 });
        return;
      }
      if (eq.bombs === 1) {
        add('bombs', [x, -1.62, z], [0, 0, 0], [0.4, 0.4, 0.95], [0.3, 0.32, 0.25], { mat: 'paint', shape: 'sphere' });
        add('bombs', [x, -1.62, z], [0, 0, 0], [0.42, 0.42, 0.1], [0.9, 0.3, 0.08], { shape: 'cyl' });
      } else {
        add('bombs', [x, -1.62, z], [0, 0, 0], [0.38, 0.38, 0.9], [0.3, 0.3, 0.3], { mat: 'metal', shape: 'cyl' });
        for (const dz of [-0.3, 0.3]) add('bombs', [x, -1.62, z + dz], [0, 0, 0], [0.4, 0.4, 0.08], [0.95, 0.8, 0.1], { shape: 'cyl' });
      }
    });
  }

  // ---- fuel tanks
  if (eq.fuel === 1) for (const x of [-1, 1]) {
    add('fuel', [x * 1.3, -0.95, 0.4], [0, 0, 0], [0.55, 0.55, 2.6], trim, { mat: pm, shape: { cap: [0.27, 0.27] } });
    add('fuel', [x * 1.3, -0.95, 0.4], [0, 0, 0], [0.58, 0.58, 0.1], [0.85, 0.65, 0.1], { shape: 'cyl' });
  }
  if (eq.fuel >= 2) for (const x of [-1.9, 1.9]) {
    add('fuel', [x, -0.62, 0.5], [0, 0, 0], [0.12, 0.3, 0.5], GUNM, { mat: 'metal', shape: 0.02 });
    add('fuel', [x, -1.05, 0.4], [0, 0, 0], [0.75, 0.75, 3.4], body, { mat: pm, shape: { cap: [0.37, 0.2] } });
    for (const dz of [-0.6, 0.9]) add('fuel', [x, -1.05, 0.4 + dz], [0, 0, 0], [0.78, 0.78, 0.1], [0.85, 0.65, 0.1], { shape: 'cyl' });
  }

  if (eq.fuel === 3) for (const x of [-1, 1]) add('fuel', [x * 1.16, 0.35, 1.9], [0, 0, 0], [0.04, 0.22, 0.22], [0.85, 0.65, 0.1], { shape: 'cyl', r: [0, Math.PI / 2, 0] });

  // ---- armour
  const ar = eq.armor;
  if (ar >= 1) {
    const th = ar >= 2 ? 0.14 : 0.08;
    for (const x of [-1, 1]) {
      add('armor', [x * (1.2 + th / 2), -0.2, -0.3], [0, 0, 0], [th, 1.1, 1.4], PLATE, { mat: 'metal', shape: 0.03 });
      add('armor', [x * (1.2 + th / 2), -0.62, 1.4], [0, 0, 0], [th, 0.5, 1.8], PLATE, { mat: 'metal', shape: 0.03 });
      for (const z of [-0.85, 0.25]) for (const y of [-0.6, 0.2]) add('armor', [x * (1.21 + th), y, z], [0, 0, 0], [0.05, 0.07, 0.07], STEEL, { mat: 'steel', shape: 'sphere' });
    }
    add('armor', [0, -0.55, -3.5], [0.35, 0, 0], [1.3, 0.55, 0.1], PLATE, { mat: 'metal', shape: 0.03 });
  }
  if (ar >= 2) {
    add('armor', [0, 1.64, 0.6], [0, 0, 0], [1.5, 0.08, 2.4], PLATE, { mat: 'metal', shape: 0.03 });
    add('armor', [0, -1.2, 0.2], [0, 0, 0], [1.8, 0.1, 3.0], PLATE, { mat: 'metal', shape: 0.03 });
  }
  if (ar >= 3) {
    for (const z of [3.0, 4.6, 6.2]) add('armor', [0, z < 4 ? 0.42 : 0.5, z], [0, 0, 0], [z < 4 ? 1.0 : 0.72, z < 4 ? 1.0 : 0.72, 0.22], PLATE, { mat: 'metal', shape: 0.1 });
    for (const x of [-1.25, 1.25]) add('armor', [x, -1.6, 0.25], [0, 0, 0], [0.08, 0.35, 3.4], PLATE, { mat: 'metal', shape: 0.02 });
  }

  if (ar === 4) {
    // CERAMIC COMPOSITE: sand-coloured tiles bolted over the sides, nose and roof
    const CER = [0.6, 0.56, 0.46], CER2 = [0.52, 0.48, 0.4];
    for (const x of [-1, 1]) for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) add('armor', [x * 1.27, -0.55 + j * 0.62, -1.2 + i * 0.75], [0, 0, 0], [0.07, 0.56, 0.68], (i + j) % 2 ? CER : CER2, { mat: 'poly', shape: 0.03 });
    add('armor', [0, -0.5, -3.6], [0.4, 0, 0], [1.45, 0.75, 0.09], CER, { mat: 'poly', shape: 0.04 });
    for (let i = 0; i < 3; i++) add('armor', [0, 1.67, -0.4 + i * 0.85], [0, 0, 0], [1.4, 0.06, 0.78], i % 2 ? CER : CER2, { mat: 'poly', shape: 0.03 });
  }

  // ---- cabin: side pods for 12 seats, and the survivors you're carrying
  if (eq.cabin >= 2) for (const x of [-1, 1]) {
    add('cabin', [x * 1.55, -0.6, 0.9], [0, 0, 0], [0.75, 0.95, 2.4], body, { mat: pm, shape: 0.3 });
    add('cabin', [x * 1.93, -0.4, 0.9], [0, 0, 0], [0.04, 0.3, 1.6], GLASS, { mat: 'glass' });
    if (eq.cabin === 3) {
      add('cabin', [x * 1.62, -0.55, 2.6], [0, 0, 0], [0.9, 1.05, 1.6], body, { mat: pm, shape: 0.3 });
      add('cabin', [x * 2.08, -0.35, 2.6], [0, 0, 0], [0.04, 0.3, 1.0], GLASS, { mat: 'glass' });
      add('cabin', [x * 1.62, -0.05, 1.75], [0, 0, 0], [0.92, 0.08, 4.2], trim, { mat: pm, shape: 0.03 });
    }
  }
  const seats = kind === 'mule' ? Array.from({ length: 32 }, (_, i) => [(i % 2 ? -0.95 : 0.95), -0.55, -4.6 + Math.floor(i / 2) * 0.62])
    : kind === 'hornet' ? [[1.05, -0.5, -0.5], [-1.05, -0.5, -0.5], [1.05, -0.5, 0.2], [-1.05, -0.5, 0.2]]
    : kind === 'reaper' ? [[0, -0.1, -3.3], [0, 0.2, -2.1]] : [[0.7, -0.4, 0.2], [-0.7, -0.4, 0.2], [0.7, -0.4, 1.2], [-0.7, -0.4, 1.2], [0.3, -0.4, 0.7], [-0.3, -0.4, 0.7], [0.7, -0.4, -0.5], [-0.7, -0.4, -0.5], [1.55, -0.5, 0.4], [-1.55, -0.5, 0.4], [1.55, -0.5, 1.4], [-1.55, -0.5, 1.4]];
  // crew sit up front, in helmets the colour of their job
  const crew = st.crew || [];
  crew.forEach((c, i) => {
    const [x, y, z] = (kind === 'mule' ? [[0.55, -0.35, -6.3], [-0.55, -0.35, -6.3], [0.9, -0.35, -5.0], [-0.9, -0.35, -5.0]] : kind === 'hornet' ? [[0.35, -0.55, -1.1], [-0.35, -0.55, -1.1], [1.05, -0.5, -0.5], [-1.05, -0.5, -0.5]] : kind === 'reaper' ? [[0, -0.1, -3.3], [0, 0.2, -2.1], [0, 0.2, -2.1], [0, 0.2, -2.1]] : [[0.55, -0.35, -0.95], [-0.55, -0.35, -0.95], [0.55, -0.35, -0.2], [-0.55, -0.35, -0.2]])[i % 4];
    B([x, y, z], [0.44, 0.6, 0.38], [0.3, 0.33, 0.25], { shape: 0.08, mat: 'cloth' });
    B([x, y + 0.48, z], [0.27, 0.29, 0.27], SKIN[(i + 1) % SKIN.length], { shape: 'sphere', mat: 'skin' });
    B([x, y + 0.6, z], [0.33, 0.2, 0.35], c.col || [0.3, 0.3, 0.3], { shape: 'sphere' });
  });
  for (let i = 0; i < Math.min(st.riders || 0, seats.length); i++) {
    const [x, y, z] = seats[i];
    B([x, y, z], [0.42, 0.55, 0.35], SHIRTS[i % SHIRTS.length], { shape: 0.08, mat: 'cloth' });
    B([x, y + 0.45, z], [0.26, 0.28, 0.26], SKIN[i % SKIN.length], { shape: 'sphere', mat: 'skin' });
  }

  PV = null;
  // ---- gun pods under the wings: a fat pod, a fairing and a barrel; they flash when they fire
  if (eq.pods) {
    const px = eq.rockets || eq.bombs ? 2.7 : 1.8;
    for (const x of [-px, px]) {
      PV = [x, -0.3, 0.2];
      const big = eq.pods === 2;
      add('rockets', [x, -0.4, 0.2], [0, 0, 0], [0.1, 0.24, 0.9], GUNM, { mat: 'metal', shape: 0.02 });
      add('rockets', [x, -0.74, 0.25], [0, 0, 0], [0.42, 0.46, 2.1], big ? [0.3, 0.32, 0.26] : GUNM, { mat: 'metal', shape: 'cyl' });
      add('rockets', [x, -0.74, -0.85], [0, 0, 0], [0.36, 0.4, 0.3], DARK, { shape: 'sphere', mat: 'metal' });
      add('rockets', [x, -0.74, -1.45], [0, 0, 0], [big ? 0.14 : 0.09, big ? 0.14 : 0.09, 1.1], STEEL, { mat: 'steel', shape: 'cyl' });
      if (big) add('rockets', [x, -0.74, -1.95], [0, 0, 0], [0.2, 0.2, 0.22], GUNM, { mat: 'metal', shape: 'cyl' });       // muzzle brake
      add('rockets', [x + 0.22, -0.74, 0.6], [0, 0, 0], [0.04, 0.18, 0.5], [0.85, 0.7, 0.15], {});                      // ammo feed cover
      if (st.podFlash > 0 && (st.podSide == null || Math.sign(st.podSide) === Math.sign(x))) add('rockets', [x, -0.74, -2.25], [0, 0, st.t * 40], [0.4, 0.4, 0.55], [1, 0.75, 0.35], { em: 1, shape: 'sphere', alpha: 0.85 });
    }
  }
  PV = null;
  // ---- targeting pod: a sensor pod on the left of the chin, a big glass eye at the front
  if (eq.tpod) {
    add('flir', [-0.78, -1.02, -2.4], [0, 0, 0], [0.34, 0.34, 1.2], [0.75, 0.76, 0.74], { mat: 'paint', shape: 'cyl' });
    add('flir', [-0.78, -1.02, -3.05], [0, 0, 0], [0.33, 0.33, 0.33], [0.06, 0.08, 0.12], { mat: 'glass', shape: 'sphere' });
    add('flir', [-0.6, -0.86, -2.4], [0, 0, 0], [0.12, 0.16, 0.6], GUNM, { mat: 'metal' });
    if (eq.tpod === 2) add('flir', [-0.78, -1.02, -1.75], [0, 0, 0], [0.36, 0.36, 0.2], GUNM, { mat: 'metal', shape: 'cyl' });
    if (st.t && (st.t * 3) % 1 < 0.15) add('flir', [-0.78, -1.02, -3.2], [0, 0, 0], [0.06, 0.06, 0.06], [1, 0.15, 0.1], { em: 1, shape: 'sphere' });
  }
  // ---- quiet kit: baffle boxes over the exhausts
  if (eq.quiet) for (const x of [-0.55, 0.55]) {
    add('engine', [x, 1.45, 2.55], [0, 0, 0], [0.62, 0.55, 0.8], [0.18, 0.18, 0.19], { mat: 'metal', shape: 0.12 });
    for (let k = 0; k < 3; k++) add('engine', [x, 1.3 + k * 0.15, 2.97], [0, 0, 0], [0.5, 0.04, 0.04], [0.05, 0.05, 0.05], {});
  }
  // ---- the marksman: kneeling in the back of the left door with a long scoped rifle
  if (eq.sniper) {
    const ex = -0.75, aim = st.snipeAim;
    add('door', [ex, -0.55, 1.45], [0, 0, 0], [0.5, 0.45, 0.55], [0.28, 0.3, 0.22], { mat: 'cloth', shape: 0.1 });
    add('door', [ex, -0.05, 1.45], [0, 0, 0], [0.44, 0.55, 0.36], [0.3, 0.33, 0.24], { mat: 'cloth', shape: 0.1 });
    add('door', [ex, 0.42, 1.45], [0, 0, 0], [0.3, 0.32, 0.3], [0.86, 0.68, 0.55], { mat: 'skin', shape: 'sphere' });
    add('door', [ex, 0.53, 1.45], [0, 0, 0], [0.36, 0.2, 0.38], [0.24, 0.27, 0.2], { shape: 'sphere' });
    const yw = aim ? aim[0] : Math.PI / 2, pt = aim ? aim[1] : -0.15, d = [-Math.sin(yw) * Math.cos(pt), Math.sin(pt), -Math.cos(yw) * Math.cos(pt)];
    const L = eq.sniper === 2 ? 1.7 : 1.3;
    add('door', [ex - 0.25 + d[0] * L * 0.5, 0.25 + d[1] * L * 0.5, 1.45 + d[2] * L * 0.5], [pt, yw, 0], [0.07, 0.09, L], GUNM, { mat: 'metal', shape: 0.02 });
    add('door', [ex - 0.25 + d[0] * L * 0.35, 0.36 + d[1] * L * 0.35, 1.45 + d[2] * L * 0.35], [pt, yw, 0], [0.07, 0.07, 0.4], DARK, { mat: 'metal', shape: 'cyl' });   // the scope
    if (st.snipeFlash > 0) add(null, [ex - 0.25 + d[0] * (L + 0.2), 0.25 + d[1] * (L + 0.2), 1.45 + d[2] * (L + 0.2)], [0, 0, 0], [0.35, 0.35, 0.35], [1, 0.85, 0.5], { em: 1, shape: 'sphere', alpha: 0.85 });
  }
  // ---- door gunners (they turn their guns to shoot)
  for (let sd = 0; sd < 2; sd++) {
    const friend = st.doorFriend && st.doorFriend[sd];
    if (sd >= eq.door && !friend) continue;
    const x = sd === 0 ? 1 : -1, aim = (st.doorAim && st.doorAim[sd]) || [x > 0 ? -Math.PI / 2 : Math.PI / 2, -0.3];
    if (!(friend && friend.self)) {
      add('door', [x * 0.75, -0.35, 0.65], [0, 0, 0], [0.5, 0.65, 0.45], friend ? [0.15, 0.2, 0.35] : [0.3, 0.34, 0.24], { mat: 'cloth', shape: 0.1 });
      add('door', [x * 0.75, 0.15, 0.65], [0, 0, 0], [0.32, 0.32, 0.34], [0.86, 0.68, 0.55], { mat: 'skin', shape: 'sphere' });
      add('door', [x * 0.75, 0.26, 0.65], [0, 0, 0], [0.38, 0.22, 0.4], friend ? friend.col || [1, 0.8, 0.1] : [0.25, 0.3, 0.2], { shape: 'sphere', em: friend ? 0.3 : 0 });
    }
    add('door', [x * 1.25, -0.3, 0.6], [0, 0, 0], [0.08, 0.7, 0.08], GUNM, { mat: 'metal', shape: 'cylY' });
    const [yw, pt] = aim, d = [-Math.sin(yw) * Math.cos(pt), Math.sin(pt), -Math.cos(yw) * Math.cos(pt)];
    add('door', [x * 1.25 + d[0] * 0.5, 0.1 + d[1] * 0.5, 0.6 + d[2] * 0.5], [pt, yw, 0], [0.14, 0.16, 1.1], GUNM, { mat: 'metal', shape: 0.03 });
    if (eq.door === 3) {
      // door miniguns: six spinning barrels
      const sp = st.t * 25 * (st.doorFlash && st.doorFlash[sd] > 0 ? 1 : 0.1);
      const up = [Math.sin(yw) * Math.sin(pt) * -1, Math.cos(pt), Math.cos(yw) * Math.sin(pt) * -1], rt = [Math.cos(yw), 0, -Math.sin(yw)];
      for (let k = 0; k < 6; k++) {
        const a = sp + k * 1.047, ox = Math.cos(a) * 0.07, oy = Math.sin(a) * 0.07;
        add('door', [x * 1.25 + d[0] * 1.2 + rt[0] * ox + up[0] * oy, 0.1 + d[1] * 1.2 + up[1] * oy, 0.6 + d[2] * 1.2 + rt[2] * ox + up[2] * oy], [pt, yw, 0], [0.035, 0.035, 0.75], STEEL, { mat: 'steel', shape: 'cyl' });
      }
    } else if (eq.door === 4 && !friend) {
      // Mk 19: a fat short barrel and a grenade can on the side
      add('door', [x * 1.25 + d[0] * 1.1, 0.1 + d[1] * 1.1, 0.6 + d[2] * 1.1], [pt, yw, 0], [0.14, 0.14, 0.55], GUNM, { mat: 'metal', shape: 'cyl' });
      add('door', [x * 1.25 + d[0] * 0.45 - x * 0.2, 0.0 + d[1] * 0.45, 0.6 + d[2] * 0.45], [0, yw, 0], [0.22, 0.3, 0.36], [0.3, 0.33, 0.22], { mat: 'metal', shape: 0.03 });
    } else add('door', [x * 1.25 + d[0] * 1.15, 0.1 + d[1] * 1.15, 0.6 + d[2] * 1.15], [pt, yw, 0], [0.06, 0.06, 0.5], STEEL, { mat: 'steel', shape: 'cyl' });
    if (st.doorFlash && st.doorFlash[sd] > 0) add(null, [x * 1.25 + d[0] * 1.5, 0.1 + d[1] * 1.5, 0.6 + d[2] * 1.5], [0, 0, 0], [0.3, 0.3, 0.3], [1, 0.8, 0.4], { em: 1, shape: 'sphere', alpha: 0.85 });
  }
  // ---- shield: emitters on the sides, and the bubble when it's up (it flashes when hit)
  const sh = eq.shield || 0;
  if (sh) {
    for (const [x, y, z] of [[1.18, 0.75, -1.4], [-1.18, 0.75, -1.4], [0, 1.85, -0.6], [0, 0.95, 5.0]]) {
      add('shield', [x, y, z], [0, 0, 0], [0.26, 0.26, 0.26], GUNM, { mat: 'metal', shape: 'sphere' });
      add('shield', [x, y + 0.08, z], [0, 0, 0], [0.16, 0.16, 0.16], [0.35, 0.85, 1], { em: 0.7 + 0.3 * Math.sin(st.t * 4 + x), shape: 'sphere' });
    }
    if (st.shieldK > 0 && !st.install) {
      const a = 0.05 + (st.shieldHit || 0) * 0.35;
      add(null, [0, 0.4, 1.2], [0, st.t * 0.3, 0], [8 + sh * 0.6, 6.2, 15 + sh * 0.8], [0.35, 0.8, 1], { em: 1, shape: 'sphere', alpha: a * st.shieldK });
    }
  }
  // ---- flare dispensers on the tail
  if (eq.flares) for (const x of [-1, 1]) {
    add('flares', [x * 0.5, 0.15, 3.6], [0, 0, 0], [0.22, 0.45, 0.8], GUNM, { mat: 'metal', shape: 0.04 });
    for (let k = 0; k < (eq.flares === 2 ? 4 : 2); k++) add('flares', [x * 0.62, 0.05 + (k % 2) * 0.2, 3.35 + Math.floor(k / 2) * 0.4], [0, 0, 0], [0.04, 0.12, 0.12], [1, 0.75, 0.2], { em: (st.flares ?? 1) > k / 4 ? 0.8 : 0.05, shape: 'cyl' });
  }
  // ---- tail gun: a turret under the tail boom
  if (eq.tail) {
    const [yw, pt] = st.tailAim || [Math.PI, -0.3], d = [-Math.sin(yw) * Math.cos(pt), Math.sin(pt), -Math.cos(yw) * Math.cos(pt)];
    add('tail', [0, -0.1, 4.6], [0, 0, 0], [0.35, 0.5, 0.35], GUNM, { mat: 'metal', shape: 'cylY' });
    add('tail', [0, -0.4, 4.6], [pt, yw, 0], [0.55, 0.4, 0.6], trim, { mat: 'metal', shape: 'sphere' });
    for (const dx of eq.tail === 2 ? [-0.13, 0.13] : [0]) {
      const rt = [Math.cos(yw), 0, -Math.sin(yw)];
      add('tail', [rt[0] * dx + d[0] * 0.75, -0.4 + d[1] * 0.75, 4.6 + rt[2] * dx + d[2] * 0.75], [pt, yw, 0], [0.08, 0.08, 1.0], STEEL, { mat: 'steel', shape: 'cyl' });
      if (st.tailFlash > 0) add(null, [rt[0] * dx + d[0] * 1.3, -0.4 + d[1] * 1.3, 4.6 + rt[2] * dx + d[2] * 1.3], [0, 0, 0], [0.28, 0.28, 0.28], [1, 0.8, 0.4], { em: 1, shape: 'sphere', alpha: 0.85 });
    }
  }
  // ---- winch arm over the right door (a magnet on the end at tier 2)
  if (eq.winch) {
    add('winch', [1.35, 0.85, 0.0], [0, 0, 0], [0.18, 0.18, 0.5], GUNM, { mat: 'metal', shape: 0.03 });
    add('winch', [1.75, 0.95, 0.0], [0, 0, -0.25], [0.9, 0.12, 0.12], [0.9, 0.7, 0.1], { mat: 'paint', shape: 0.02 });
    add('winch', [2.15, 0.9, 0.0], [0, 0, 0], [0.14, 0.2, 0.14], STEEL, { mat: 'steel', shape: 'cylY' });
    const L = st.cable || 0.8;
    add('winch', [2.15, 0.85 - L / 2, 0.0], [0, 0, 0], [0.03, L, 0.03], [0.1, 0.1, 0.1], {});
    if (eq.winch === 3) {
      // RESCUE HOIST: a powered drum on the arm, an orange hook with a lift strop
      add('winch', [1.9, 1.08, 0.0], [0, 0, 0], [0.42, 0.34, 0.34], [0.85, 0.85, 0.82], { mat: 'paint', shape: 0.05 });
      add('winch', [1.9, 1.08, 0.0], [0, 0, 0], [0.44, 0.24, 0.24], GUNM, { mat: 'metal', shape: 'cyl', r: [0, Math.PI / 2, 0] });
      add('winch', [2.15, 0.85 - L - 0.18, 0.0], [0, 0, 0], [0.24, 0.3, 0.2], [1, 0.45, 0.08], { mat: 'paint', shape: 0.05 });
      add('winch', [2.15, 0.85 - L - 0.45, 0.0], [0, 0, 0.6], [0.06, 0.32, 0.06], STEEL, { mat: 'steel' });
      add('winch', [2.15, 0.85 - L - 0.75, 0.0], [0, 0, 0], [0.5, 0.5, 0.06], [0.95, 0.75, 0.1], { shape: 'cyl', r: [0, Math.PI / 2, 0], alpha: 0.9 });
    } else if (eq.winch === 2) {
      // cargo hook: a heavy yellow block and hook
      add('winch', [2.15, 0.85 - L - 0.2, 0.0], [0, 0, 0], [0.4, 0.4, 0.3], [0.95, 0.75, 0.1], { mat: 'paint', shape: 0.05 });
      add('winch', [2.15, 0.85 - L - 0.55, 0.0], [0, 0, 0.6], [0.08, 0.4, 0.08], STEEL, { mat: 'steel' });
      add('winch', [2.22, 0.85 - L - 0.72, 0.0], [0, 0, 0], [0.22, 0.08, 0.08], STEEL, { mat: 'steel' });
    } else add('winch', [2.15, 0.85 - L - 0.12, 0.0], [0.6, 0, 0], [0.08, 0.25, 0.2], STEEL, { mat: 'steel' });
  }
  // ---- thermal camera: a turret ball under the nose that looks where you look
  if (eq.flir) {
    add('flir', [0, -1.2, -2.3], [0, 0, 0], [0.12, 0.3, 0.12], GUNM, { mat: 'metal', shape: 'cylY' });
    add('flir', [0, -1.45, -2.3], [0, st.t * 0.6, 0], [0.55, 0.55, 0.55], [0.85, 0.85, 0.82], { mat: 'paint', shape: 'sphere' });
    add('flir', [0, -1.45, -2.57], [0, 0, 0], [0.24, 0.24, 0.04], [0.06, 0.06, 0.1], { mat: 'glass', shape: 'cyl' });
    if (eq.flir === 2) add('flir', [0.16, -1.36, -2.56], [0, 0, 0], [0.08, 0.08, 0.03], [1, 0.25, 0.1], { em: 0.8, shape: 'cyl' });
  }
  // ---- loudspeakers on the stub wing roots
  if (eq.speaker === 1) for (const x of [-1.3, 1.3]) {
    add('speaker', [x, 0.9, -0.6], [0, 0, 0], [0.5, 0.4, 0.3], GUNM, { mat: 'metal', shape: 0.04 });
    add('speaker', [x, 0.9, -0.95], [0, 0, 0], [0.62, 0.52, 0.5], [0.85, 0.85, 0.82], { mat: 'paint', shape: { taper: [0.55, 0.55], r: 0.03 } });
    add('speaker', [x, 0.9, -1.21], [0, 0, 0], [0.5, 0.4, 0.03], [0.1, 0.1, 0.1], {});
    if (st.siren) add(null, [x, 0.9, -1.3], [0, 0, 0], [0.5, 0.4, 0.1], [1, 0.2, 0.15], { em: (st.t * 4) % 1 < 0.5 ? 1 : 0.2 });
  }
  if (eq.speaker === 2) for (const x of [-1.4, 1.4]) {
    // LRAD: a flat round acoustic panel on a yoke each side, its face lights up while it's sounding
    add('speaker', [x, 0.85, -0.5], [0, 0, 0], [0.16, 0.5, 0.16], GUNM, { mat: 'metal', shape: 'cylY' });
    add('speaker', [x, 0.95, -0.8], [0.12, 0, 0], [0.95, 0.95, 0.32], [0.18, 0.19, 0.2], { mat: 'metal', shape: 'cyl' });
    add('speaker', [x, 0.95, -0.97], [0.12, 0, 0], [0.86, 0.86, 0.03], st.siren ? [0.9, 0.3, 0.2] : [0.08, 0.08, 0.09], { em: st.siren ? 0.5 + 0.5 * Math.sin(st.t * 18) : 0, shape: 'cyl' });
    for (let k = 0; k < 4; k++) add('speaker', [x, 0.95, -0.99], [0.12, 0, k * 0.785], [0.84, 0.02, 0.02], GUNM, {});
  }
  // ---- anti-climb skids: spikes along the skids
  if (eq.skids) for (const x of [-1.25, 1.25]) for (let k = 0; k < 7; k++) {
    add('skids', [x, -1.98, -1.6 + k * 0.65], [0, 0, 0], [0.06, 0.32, 0.06], STEEL, { mat: 'steel', shape: { taper: [0.1, 0.1], r: 0.01 } });
    add('skids', [x + (x > 0 ? 0.12 : -0.12), -1.85, -1.6 + k * 0.65], [0, 0, x > 0 ? -1.4 : 1.4], [0.06, 0.3, 0.06], STEEL, { mat: 'steel' });
  }
  if (eq.skids === 2) for (const x of [-1.25, 1.25]) {
    // electric skids: coils and a crackle
    for (let k = 0; k < 4; k++) add('skids', [x, -1.92, -1.3 + k * 1.1], [0, 0, 0], [0.16, 0.16, 0.34], [0.25, 0.45, 0.9], { em: st.zap > 0 ? 1 : 0.35, shape: 'cyl' });
  }
  // ---- searchlight(s): a big lamp on a yoke under the nose
  if (eq.light) for (const x of eq.light === 2 ? [-0.45, 0.45] : [0]) {
    add('light', [x, -1.15, -3.1], [0, 0, 0], [0.12, 0.35, 0.12], GUNM, { mat: 'metal', shape: 'cylY' });
    add('light', [x, -1.4, -3.15], [0.55, 0, 0], [0.5, 0.5, 0.42], [0.2, 0.21, 0.22], { mat: 'metal', shape: 'cyl' });
    add('light', [x, -1.52, -3.36], [0.55, 0, 0], [0.42, 0.42, 0.05], [1, 0.96, 0.85], { em: st.lightOn ? 1 : 0.15, shape: 'cyl' });
  }
  // ---- belly turret: a ball with a gun (two for tier 2) under the cabin
  if (eq.turret) {
    add('turret', [0, -1.4, 0.6], [0, 0, 0], [0.3, 0.25, 0.3], GUNM, { mat: 'metal', shape: 'cylY' });
    add('turret', [0, -1.62, 0.6], [0, st.tYaw || 0, 0], [0.62, 0.5, 0.62], [0.24, 0.26, 0.24], { mat: 'metal', shape: 'sphere' });
    const ty = st.tYaw || 0;
    for (const o of eq.turret === 2 ? [-0.12, 0.12] : [0]) add('turret', [Math.cos(ty) * o + Math.sin(ty) * -0.5, -1.7, 0.6 + Math.cos(ty) * -0.5 - Math.sin(ty) * o], [0.35, ty, 0], [0.06, 0.06, 0.9], GUNM, { mat: 'metal', shape: 'cyl' });
  }
  // ---- medical bay: stretchers in the cabin and a red cross on each side
  if (eq.medbay) for (const x of [-1, 1]) {
    add('medbay', [x * 1.205, 0.35, 1.2], [0, 0, 0], [0.02, 0.7, 0.7], [0.95, 0.95, 0.92], { mat: 'paint' });
    add('medbay', [x * 1.215, 0.35, 1.2], [0, 0, 0], [0.02, 0.5, 0.15], [0.85, 0.1, 0.1], { mat: 'paint' });
    add('medbay', [x * 1.215, 0.35, 1.2], [0, 0, 0], [0.02, 0.15, 0.5], [0.85, 0.1, 0.1], { mat: 'paint' });
    if (eq.medbay === 2) {
      // FIELD HOSPITAL: stretchers inside, an oxygen bottle, and a red/blue light bar on the roof
      add('medbay', [x * 0.55, -0.55, 1.1], [0, 0, 0], [0.55, 0.08, 1.7], [0.9, 0.9, 0.88], { mat: 'cloth' });
      add('medbay', [x * 0.85, 0.0, 1.9], [0, 0, 0], [0.18, 0.7, 0.18], [0.25, 0.75, 0.35], { mat: 'paint', shape: 'cylY' });
      add('medbay', [x * 0.3, 1.8, -0.35], [0, 0, 0], [0.5, 0.12, 0.22], x > 0 ? [1, 0.12, 0.08] : [0.15, 0.35, 1], { em: ((st.t * 2.5) % 1 < 0.5) === x > 0 ? 1 : 0.15, shape: 0.04 });
    }
  }
  if (eq.medbay === 2) add('medbay', [0, -1.25, 0.6], [0, 0, 0], [0.8, 0.02, 0.24], [0.85, 0.1, 0.1], {}), add('medbay', [0, -1.25, 0.6], [0, 0, 0], [0.24, 0.02, 0.8], [0.85, 0.1, 0.1], {});
  // ---- supply chutes: a rack of crates with packed chutes on the left side
  if (eq.drops) for (let k = 0; k < (eq.drops === 2 ? 3 : 2); k++) {
    add('drops', [-1.55, -0.7, 0.2 + k * 0.7], [0, 0, 0], [0.5, 0.5, 0.55], [0.45, 0.4, 0.22], { tex: 12, shape: 0.03 });
    add('drops', [-1.55, -0.38, 0.2 + k * 0.7], [0, 0, 0], [0.45, 0.16, 0.5], [0.35, 0.4, 0.3], { shape: 0.05 });
  }
  // ---- long range radio: a tall whip aerial and a box on the tail boom
  if (eq.radio) {
    add('radio', [0.25, 0.9, 4.2], [0, 0, 0], [0.4, 0.35, 0.6], GUNM, { mat: 'metal', shape: 0.04 });
    add('radio', [0.25, 2.0, 4.2], [-0.12, 0, 0], [0.04, 2.2, 0.04], [0.15, 0.15, 0.15], { mat: 'metal' });
    add('radio', [0.25, 3.1, 4.07], [0, 0, 0], [0.09, 0.09, 0.09], [1, 0.2, 0.15], { em: (st.t * 1.2) % 1 < 0.2 ? 1 : 0.15, shape: 'sphere' });
  }
  if (eq.radio === 2) {
    // SATCOM: a white satellite dome on the tail boom
    add('radio', [0, 0.98, 3.4], [0, 0, 0], [0.7, 0.5, 0.85], [0.9, 0.9, 0.88], { mat: 'poly', shape: 'sphere' });
    add('radio', [0, 0.78, 3.4], [0, 0, 0], [0.74, 0.08, 0.9], GUNM, { mat: 'metal', shape: 0.03 });
  }
  // ---- night vision: an infrared lamp under the nose (glows a dull red when it's on)
  if (eq.nvg) {
    add('nvg', [0.55, -0.92, -3.25], [0, 0, 0], [0.24, 0.2, 0.26], GUNM, { mat: 'metal', shape: 0.04 });
    add('nvg', [0.55, -0.92, -3.39], [0, 0, 0], [0.18, 0.15, 0.02], st.nvgOn ? [0.6, 0.08, 0.06] : [0.12, 0.05, 0.05], { em: st.nvgOn ? 0.6 : 0, mat: 'glass' });
  }
  // ---- weapon racks: an extra pod or bomb on each wing tip
  if (eq.racks && (eq.rockets || eq.bombs)) for (const x of [-2.55, 2.55]) {
    add('racks', [x, -0.42, 0.5], [0, 0, 0], [0.1, 0.22, 0.9], GUNM, { mat: 'metal', shape: 0.02 });
    if (eq.rockets) {
      add('racks', [x, -0.72, 0.45], [0, 0, 0], [0.48, 0.48, 1.4], trim, { mat: 'metal', shape: 'cyl' });
      add('racks', [x, -0.72, -0.27], [0, 0, 0], [0.36, 0.36, 0.03], [0.04, 0.04, 0.04], { shape: 'cyl' });
      if (eq.racks === 2) add('racks', [x, -0.72, -0.3], [0, 0, 0], [0.12, 0.12, 0.12], [0.85, 0.12, 0.1], { shape: 'sphere' });
    } else {
      add('racks', [x, -0.75, 0.5], [0, 0, 0], [0.36, 0.36, 1.0], [0.3, 0.32, 0.25], { mat: 'paint', shape: 'sphere' });
    }
  }
  // ---- drones: a launch pad on top of the tail boom (they're parked there in the hangar)
  if (eq.drone) {
    add('drone', [0, 0.95, 5.3], [0, 0, 0], [0.9, 0.06, 0.9], GUNM, { mat: 'metal', shape: 0.02 });
    if (st.hangar) for (let k = 0; k < (eq.drone === 3 ? 2 : 1); k++) droneParts((p, r, sc, col, o) => add('drone', p, r, sc, col, o), [0, 1.12 + k * 0.32, 5.3], 0, 0, eq.drone >= 2, false);
  }
  // ---- fire suppression: red extinguisher bottles by the engines; repairs: a toolbox and spares on the cabin wall
  if (eq.suppress) for (const x of [-0.5, 0.5]) add('suppress', [x, 1.62, 2.3], [Math.PI / 2, 0, 0], [0.22, 0.6, 0.22], [0.8, 0.1, 0.08], { mat: 'paint', shape: 'cylY' });
  if (eq.repair) {
    add('repair', [1.12, -0.85, -0.6], [0, 0, 0], [0.12, 0.3, 0.6], [0.8, 0.2, 0.12], { mat: 'paint', shape: 0.03 });
    if (eq.repair === 2) add('repair', [-1.12, -0.85, -0.6], [0, 0, 0], [0.12, 0.3, 0.6], [0.8, 0.2, 0.12], { mat: 'paint', shape: 0.03 });
  }
  // ---- ammo: coloured tips on the belt (black = armour-piercing, red = incendiary)
  if (eq.ammo && (eq.gun || 0) <= 3) add('ammo', [0.25, -1.08, -2.35], [0, 0, 0], [0.44, 0.05, 0.57], eq.ammo === 1 ? [0.08, 0.08, 0.08] : [0.85, 0.12, 0.08], { em: eq.ammo === 2 ? 0.3 : 0 });
  // ---- noise beacons: a launcher on the left of the tail boom, one orange canister for each beacon left
  if (eq.beacon) {
    const n = eq.beacon === 2 ? 5 : 3, left = Math.round((st.beacons ?? 1) * n);
    add('beacon', [-0.55, 0.42, 3.45], [0, 0, 0], [0.28, 0.5, 1.15], GUNM, { mat: 'metal', shape: 0.04 });
    for (let k = 0; k < n; k++) {
      const z = 3.0 + (k % 3) * 0.32, y = 0.3 + Math.floor(k / 3) * 0.26;
      add('beacon', [-0.72, y, z], [0, 0, Math.PI / 2], [0.2, 0.08, 0.2], [0.05, 0.05, 0.05], { shape: 'cylY' });
      if (k < left) add('beacon', [-0.74, y, z], [0, 0, Math.PI / 2], [0.15, 0.06, 0.15], eq.beacon === 2 ? [1, 0.25, 0.1] : [1, 0.6, 0.1], { em: 0.45, shape: 'cylY' });
    }
  }
  // ---- radar: a spinning dish on a mast
  if (eq.radar) {
    add('radar', [0, 1.95, 2.0], [0, 0, 0], [0.12, 0.6, 0.12], GUNM, { mat: 'metal', shape: 'cylY' });
    add('radar', [0, 2.3, 2.0], [0.3, st.t * 2.5, 0], [1.0, 0.45, 0.12], [0.85, 0.86, 0.84], { mat: 'paint', shape: 0.08 });
    if (eq.radar === 2) add('radar', [0, 2.62, 2.0], [0, 0, 0], [0.16, 0.16, 0.16], [1, 0.25, 0.15], { em: (st.t * 1.5) % 1 < 0.3 ? 1 : 0.2, shape: 'sphere' });
  }
  return out;
}

// ---- the other airframes' bodies (their upgrades bolt on via AIRFRAMES.off)
function hullFor(kind, B, add, st, eq, paint, M) {
  const camo = paint.camo || 0, TIPC = paint.tips || paint.stripe || [0.9, 0.8, 0.2];
  const body = paint.body, trim = paint.trim, glow = paint.glow;
  const tailRotor = (x, y, z, r) => {
    B([x - 0.1, y, z], [0.18, 0.18, 0.18], STEEL, { shape: 'sphere', mat: 'steel' });
    for (let i = 0; i < 2; i++) B([x, y, z], [0.05, r * 1.7, 0.16], DARK, { r: [st.tailA + i * Math.PI / 2, 0, 0], shape: undefined, mat: 'metal' });
    if (st.rpm > 0.4) B([x + 0.01, y, z], [r * 1.72, r * 1.72, 0.03], [0.2, 0.2, 0.2], { shape: 'cyl', r: [0, Math.PI / 2, 0], alpha: 0.12 * st.rpm });
  };
  const strobe = (p) => B(p, [0.12, 0.12, 0.12], [1, 1, 1], { em: (st.t * 1.2) % 1 < 0.08 ? 1 : 0.1, shape: 'sphere' });
  if (kind === 'hornet') {
    // HORNET: an egg-shaped two-seat scout with benches outside, a thin tail boom and a T-tail
    M('h_hornet'); M('h_hornet_cowl'); M('g_hornet', GLASS);
    B([0, 0.56, 1.05], [0.3, 0.3, 0.3], GUNM, { shape: 'cyl', mat: 'metal' });
    B([0, 0.56, 1.21], [0.22, 0.22, 0.03], [1, 0.45, 0.15], { shape: 'cyl', em: 0.3 + (st.rpm || 0) * 0.3 });
    for (const x of [-1, 1]) B([x * 0.79, -0.2, -0.3], [0.03, 1.2, 0.035], DARK, { shape: undefined, mat: 'metal' });
    B([0, 0.75, 4.5], [0.1, 1.05, 0.7], body, { r: [-0.35, 0, 0], shape: 0.04 });
    B([0, 1.22, 4.68], [1.5, 0.07, 0.42], trim, { shape: 0.03 });
    tailRotor(0.22, 0.75, 4.6, 0.62);
    for (const x of [-1, 1]) {
      B([x * 1.0, -1.85, -0.3], [0.12, 0.12, 3.4], GUNM, { shape: 'cyl', mat: 'metal' });
      B([x * 1.0, -1.74, -2.08], [0.12, 0.12, 0.45], GUNM, { shape: 'cyl', mat: 'metal', r: [-0.7, 0, 0] });
      for (const z of [-1.2, 0.6]) B([x * 0.82, -1.45, z], [0.09, 0.85, 0.09], GUNM, { r: [0, 0, x > 0 ? 0.4 : -0.4], shape: 0.03, mat: 'metal' });
      B([x * 1.08, -0.98, -0.15], [0.55, 0.08, 1.6], trim, { shape: 0.03 });                 // the bench
      B([x * 1.3, -0.82, -0.15], [0.05, 0.3, 1.6], GUNM, { mat: 'metal' });
    }
    B([-0.82, -0.3, -0.4], [0.1, 0.1, 0.1], [1, 0.1, 0.05], { em: 1, shape: 'sphere' });
    B([0.82, -0.3, -0.4], [0.1, 0.1, 0.1], [0.1, 1, 0.2], { em: 1, shape: 'sphere' });
    strobe([0, 1.35, 4.75]);
    if (paint.stripe) B([0, 0.25, 2.2], [0.33, 0.33, 0.4], paint.stripe, { shape: 'cyl', em: glow ? 0.8 : 0 });
  } else if (kind === 'reaper') {
    // REAPER: a narrow two-seat gunship: tandem cockpits stepped up, engine pods either side, stub wings, wheels
    M('h_reaper'); M('h_reaper_spine'); M('g_reaper_c1', GLASS); M('g_reaper_c2', GLASS);
    B([0, 0.3, -2.86], [0.92, 0.1, 0.12], trim, { shape: 0.03 });
    B([0, 0.52, -1.4], [0.9, 0.1, 0.1], trim, { shape: 0.03 });
    for (const x of [-0.85, 0.85]) {
      M('h_pod', body, { p: [x, 0.68, 0.22] });
      B([x, 0.68, -0.9], [0.5, 0.5, 0.05], DARK, { shape: 'cyl' });
      B([x * 1.15, 0.72, 1.75], [0.36, 0.36, 0.3], GUNM, { shape: 'cyl', mat: 'metal' });
      B([x * 1.15, 0.72, 1.92], [0.25, 0.25, 0.03], [1, 0.45, 0.15], { shape: 'cyl', em: 0.3 + (st.rpm || 0) * 0.3 });
    }
    B([0, -0.12, -0.5], [5.0, 0.14, 1.0], trim, { shape: 0.05 });
    for (const x of [-2.3, -1.55, 1.55, 2.3]) B([x, -0.3, -0.45], [0.12, 0.25, 0.6], GUNM, { mat: 'metal' });
    B([0, 1.05, 6.55], [0.14, 1.9, 1.05], body, { r: [-0.3, 0, 0], shape: 0.05 });
    B([0, 0.3, 6.35], [2.0, 0.08, 0.5], trim, { shape: 0.03 });
    tailRotor(0.28, 1.5, 6.75, 1.0);
    // wheels on short legs
    for (const x of [-1.2, 1.2]) {
      B([x * 0.8, -1.25, -1.9], [0.12, 0.8, 0.12], GUNM, { r: [0, 0, x > 0 ? 0.5 : -0.5], mat: 'metal' });
      B([x, -1.6, -1.9], [0.24, 0.62, 0.62], DARK, { shape: 'cyl', r: [0, Math.PI / 2, 0], mat: 'rubber' });
    }
    B([0, -1.0, 5.4], [0.1, 1.0, 0.1], GUNM, { mat: 'metal' });
    B([0, -1.62, 5.4], [0.18, 0.42, 0.42], DARK, { shape: 'cyl', r: [0, Math.PI / 2, 0], mat: 'rubber' });
    B([-2.55, -0.12, -0.5], [0.12, 0.12, 0.12], [1, 0.1, 0.05], { em: 1, shape: 'sphere' });
    B([2.55, -0.12, -0.5], [0.12, 0.12, 0.12], [0.1, 1, 0.2], { em: 1, shape: 'sphere' });
    strobe([0, 2.0, 6.95]);
    if (paint.stripe) B([0, 0.2, 3.0], [0.57, 0.64, 0.4], paint.stripe, { shape: 0.2, em: glow ? 0.8 : 0 });
  } else if (kind === 'mule') {
    // MULE: a long twin-rotor transport: a box body, a front rotor tower and a tall rear one, engines on the back,
    // fuel pods along the sides, a loading ramp, four wheels
    M('h_mule'); M('h_mule_fwd'); M('h_mule_aft'); M('g_mule', GLASS);
    for (const x of [-1, 1]) {
      B([x * 1.62, 1.75, 4.5], [0.85, 0.85, 3.0], body, { shape: 'cyl' });
      B([x * 1.62, 1.75, 6.05], [0.6, 0.6, 0.15], GUNM, { shape: 'cyl', mat: 'metal' });
      B([x * 1.62, 1.75, 6.12], [0.45, 0.45, 0.03], [1, 0.45, 0.15], { shape: 'cyl', em: 0.3 + (st.rpm || 0) * 0.3 });
      B([x * 1.62, -0.85, -0.6], [0.65, 0.95, 7.4], body, { shape: 0.32 });
      for (let k = 0; k < 6; k++) B([x * 1.48, 0.35, -4.3 + k * 1.45], [0.05, 0.5, 0.5], GLASS, { shape: 'cyl', r: [0, Math.PI / 2, 0], mat: 'glass' });
      for (const z of [-4.3, 3.6]) {
        B([x * 1.38, -1.25, z], [0.14, 0.7, 0.14], GUNM, { mat: 'metal' });
        B([x * 1.4, -1.58, z], [0.3, 0.68, 0.68], DARK, { shape: 'cyl', r: [0, Math.PI / 2, 0], mat: 'rubber' });
      }
    }
    B([0, -1.0, 6.4], [2.45, 0.16, 1.8], trim, { r: [0.38, 0, 0], shape: 0.04 });
    B([0, -1.4, -0.2], [2.4, 0.2, 10.5], trim, { shape: 0.1 });
    B([-1.5, -0.35, -6.0], [0.12, 0.12, 0.12], [1, 0.1, 0.05], { em: 1, shape: 'sphere' });
    B([1.5, -0.35, -6.0], [0.12, 0.12, 0.12], [0.1, 1, 0.2], { em: 1, shape: 'sphere' });
    strobe([0, 3.05, 6.3]);
    if (paint.stripe) for (const x of [-1.49, 1.49]) B([x, -0.55, -0.2], [0.03, 0.22, 11], paint.stripe, { em: glow ? 0.8 : 0 });
  } else if (kind === 'huey') {
    // HUEY: the classic Vietnam-era utility helicopter: a glassy nose, a "doghouse" over the engine with the exhaust
    // pointing up, wide open doors, a long thin boom, a two-blade rotor, skids
    M('h_huey'); M('h_huey_cowl'); M('g_huey', GLASS);
    B([0, 1.38, 2.35], [0.42, 0.42, 0.6], GUNM, { shape: 'cyl', mat: 'metal', r: [-0.55, 0, 0] });                  // exhaust, angled up
    B([0, 1.55, 2.6], [0.32, 0.32, 0.03], [0.1, 0.08, 0.07], { shape: 'cyl', r: [-0.55, 0, 0] });
    for (const x of [-1, 1]) {
      B([x * 1.21, -0.1, -0.35], [0.03, 2.0, 2.9], [0.05, 0.05, 0.06], { mat: 'metal' });                      // the big open door (dark inside)
      B([x * 1.22, 0.92, -0.35], [0.05, 0.06, 3.3], GUNM, { mat: 'metal' });                                     // door rail
      B([x * 1.22, -0.1, -2.0], [0.03, 1.8, 0.04], DARK, { mat: 'metal' });
      B([x * 0.7, 1.35, -1.2], [0.22, 0.32, 0.4], [0.03, 0.03, 0.035], { shape: 0.04 });                         // intake
      // skids on two curved cross tubes
      B([x * 1.3, -1.85, -0.3], [0.12, 0.12, 4.6], GUNM, { shape: 'cyl', mat: 'metal' });
      B([x * 1.3, -1.73, -2.7], [0.12, 0.12, 0.5], GUNM, { shape: 'cyl', mat: 'metal', r: [-0.7, 0, 0] });
      for (const z of [-1.6, 1.0]) {
        B([x * 1.0, -1.55, z], [0.1, 0.62, 0.1], GUNM, { r: [0, 0, x > 0 ? 0.42 : -0.42], shape: 'cylY', mat: 'metal' });
        B([x * 0.6, -1.25, z], [0.6, 0.09, 0.09], GUNM, { r: [0, 0, x > 0 ? -0.15 : 0.15], shape: 0.04, mat: 'metal' });
      }
      B([x * 1.3, -0.2, 0.9], [0.1, 0.1, 0.1], x < 0 ? [1, 0.1, 0.05] : [0.1, 1, 0.2], { em: 1, shape: 'sphere' });
    }
    // the fin, the tail plane half way down the boom, a tail skid
    B([0, 1.15, 8.15], [0.12, 1.6, 0.95], body, { r: [-0.45, 0, 0], shape: 0.05, tex: camo ? 80 + camo : 65 });
    B([0, 0.55, 5.6], [2.3, 0.07, 0.5], trim, { shape: 0.03 });
    B([0, 0.05, 8.1], [0.06, 0.5, 0.06], GUNM, { r: [0.6, 0, 0], mat: 'metal' });
    tailRotor(-0.3, 1.62, 8.3, 0.85);
    // the stabiliser bar on the rotor head (it turns with the blades)
    B([0, 2.5, -0.15], [1.7, 0.05, 0.08], DARK, { r: [0, -st.rotorA, 0], mat: 'metal' });
    for (const sx of [-1, 1]) B([Math.cos(st.rotorA) * 0.85 * sx, 2.5, -0.15 - Math.sin(-st.rotorA) * 0.85 * sx], [0.12, 0.08, 0.12], DARK, { shape: 'sphere', mat: 'metal' });
    strobe([0, 1.62, 1.6]);
    if (paint.stripe) B([0, 0.4, 4.0], [0.6, 0.62, 0.45], paint.stripe, { shape: 0.2, em: glow ? 0.8 : 0 });
  } else if (kind === 'seaking') {
    // SEA KING: a big boat-hulled search-and-rescue helicopter: float sponsons with the wheels in them, a tall fin
    // with the tail rotor, five blades, and a rescue hoist over the door as standard
    M('h_seaking'); M('h_seaking_cowl'); M('g_seaking', GLASS);
    for (const x of [-1, 1]) {
      B([x * 1.62, -0.85, 0.3], [0.9, 0.85, 2.6], body, { shape: { cap: [0.42, 0.36] } });                       // sponson / float
      B([x * 1.62, -1.62, 0.3], [0.28, 0.6, 0.6], DARK, { shape: 'cyl', r: [0, Math.PI / 2, 0], mat: 'rubber' });
      B([x * 1.95, -0.6, 0.3], [0.1, 0.1, 0.1], x < 0 ? [1, 0.1, 0.05] : [0.1, 1, 0.2], { em: 1, shape: 'sphere' });
      B([x * 1.36, 0.0, -1.2], [0.03, 1.9, 1.5], [0.05, 0.05, 0.06], { mat: 'metal' });                         // door
      B([x * 0.9, 1.55, -0.8], [0.25, 0.4, 0.6], [0.03, 0.03, 0.035], { shape: 0.04 });                         // intakes
      B([x * 0.55, 1.55, 3.3], [0.32, 0.32, 0.5], GUNM, { shape: 'cyl', mat: 'metal' });                        // exhausts
      B([x * 0.55, 1.55, 3.56], [0.24, 0.24, 0.03], [1, 0.45, 0.15], { shape: 'cyl', em: 0.3 + (st.rpm || 0) * 0.3 });
      for (let k = 0; k < 4; k++) B([x * 1.37, 0.6, -2.6 + k * 1.4], [0.02, 0.32, 0.4], GLASS, { mat: 'glass' });
    }
    // the hoist over the right door
    B([1.25, 1.2, -1.2], [0.6, 0.18, 0.2], GUNM, { mat: 'metal' });
    B([1.62, 1.05, -1.2], [0.24, 0.3, 0.3], [0.85, 0.82, 0.78], { shape: 'cyl', r: [0, 0, Math.PI / 2], mat: 'paint' });
    B([0, -1.25, -4.6], [0.1, 0.6, 0.1], GUNM, { mat: 'metal' });
    B([0, -1.62, -4.6], [0.2, 0.56, 0.56], DARK, { shape: 'cyl', r: [0, Math.PI / 2, 0], mat: 'rubber' });
    B([0, 1.85, 10.1], [0.16, 2.0, 1.2], body, { r: [-0.25, 0, 0], shape: 0.05, tex: camo ? 80 + camo : 65 });
    B([0.3, 2.3, 9.9], [1.7, 0.08, 0.5], trim, { shape: 0.03 });
    tailRotor(-0.34, 2.45, 10.45, 1.0);
    strobe([0, 3.0, 10.6]);
    if (paint.stripe) for (const x of [-1.37, 1.37]) B([x, -0.55, -1.0], [0.03, 0.2, 6.0], paint.stripe, { em: glow ? 0.8 : 0 });
  } else if (kind === 'osprey') {
    // OSPREY: a tiltrotor. The nacelles on the wingtips tip from straight up (hovering) to straight ahead (cruising)
    // as you speed up; the three-blade proprotors turn with them
    M('h_osprey'); M('g_osprey', GLASS);
    B([0, 1.55, -0.2], [14.6, 0.3, 2.5], body, { shape: 0.08, tex: camo ? 80 + camo : 65 });                    // the wing
    B([0, 1.35, -0.2], [2.3, 0.55, 3.6], body, { shape: 0.3, tex: camo ? 80 + camo : 65 });                     // wing root fairing
    for (const x of [-1, 1]) {
      B([x * 1.45, -0.8, 0.0], [0.7, 0.9, 3.4], body, { shape: { cap: [0.34, 0.3] } });                         // sponsons
      B([x * 1.5, -1.6, 0.0], [0.28, 0.6, 0.6], DARK, { shape: 'cyl', r: [0, Math.PI / 2, 0], mat: 'rubber' });
      B([x * 2.75, 1.85, 6.9], [0.14, 2.1, 1.5], body, { r: [-0.2, 0, 0], shape: 0.05, tex: camo ? 80 + camo : 65 });  // twin fins
      B([x * 1.28, 0.0, -3.0], [0.03, 1.8, 1.3], [0.05, 0.05, 0.06], { mat: 'metal' });                             // crew door
      B([x * 7.45, 1.55, -0.2], [0.1, 0.1, 0.1], x < 0 ? [1, 0.1, 0.05] : [0.1, 1, 0.2], { em: 1, shape: 'sphere' });
    }
    B([0, 0.95, 6.9], [5.7, 0.12, 1.3], trim, { shape: 0.03 });                                                    // tail plane
    B([0, -0.85, 6.2], [2.2, 0.14, 2.4], trim, { r: [0.35, 0, 0], shape: 0.04 });                                  // the ramp
    B([0, -1.25, -5.4], [0.1, 0.6, 0.1], GUNM, { mat: 'metal' });
    B([0, -1.62, -5.4], [0.2, 0.56, 0.56], DARK, { shape: 'cyl', r: [0, Math.PI / 2, 0], mat: 'rubber' });
    // the tilting nacelles and proprotors
    const tilt = st.tk != null ? st.tk : clamp(((st.vs || 0) - 8) / 32, 0, 1), th = -tilt * Math.PI / 2, ax = [0, Math.cos(th), Math.sin(th)];
    for (const x of [-1, 1]) {
      const pv = [x * 7.1, 1.55, -0.2], at = (d) => [pv[0], pv[1] + ax[1] * d, pv[2] + ax[2] * d];
      B(at(0.6), [1.05, 3.2, 1.05], body, { r: [th, 0, 0], shape: { cap: [0.5, 0.42] }, tex: camo ? 80 + camo : 65 });
      B(at(-0.9), [0.8, 0.3, 0.8], GUNM, { r: [th, 0, 0], shape: 'cylY', mat: 'metal' });                        // exhaust
      B(at(2.35), [0.62, 0.7, 0.62], STEEL, { r: [th, 0, 0], shape: 'sphere', mat: 'steel' });                  // spinner
      const R = 5.5, spinA = (st.rotorA || 0) * x;
      if ((st.rpm || 0) > 0.35) B(at(2.4), [R * 2, 0.03, R * 2], [0.15, 0.15, 0.15], { r: [th, 0, 0], shape: 'cylY', alpha: 0.12 * st.rpm });
      for (let i = 0; i < 3; i++) {
        const a = spinA + i * Math.PI * 2 / 3;
        // a blade along a direction in the rotor's plane: rotate (sin a, 0, cos a) by the tilt
        const d0 = [Math.sin(a), 0, Math.cos(a)], dir = [d0[0], -d0[2] * Math.sin(th), d0[2] * Math.cos(th)];
        const c = at(2.4).map((v, k) => v + dir[k] * R / 2), tipP = at(2.4).map((v, k) => v + dir[k] * (R - 0.25));
        const yaw = Math.atan2(dir[0], Math.hypot(dir[1], dir[2]) * Math.sign(dir[2] || 1)), pitch = -Math.asin(clamp(dir[1], -1, 1));
        B(c, [0.5, 0.07, R], DARK, { r: [pitch, yaw, 0], shape: 0.03, mat: 'metal' });
        B(tipP, [0.52, 0.08, 0.45], TIPC, { r: [pitch, yaw, 0], shape: undefined });
      }
    }
    strobe([0, 3.0, 6.9]);
    if (paint.stripe) for (const x of [-1.27, 1.27]) B([x, -0.55, -1.0], [0.03, 0.2, 7.0], paint.stripe, { em: glow ? 0.8 : 0 });
  } else if (kind === 'harrier') {
    // HARRIER: a jump jet. Four nozzles swing from pointing down (hovering) to pointing back (flying fast)
    M('h_harrier'); M('g_harrier_c', GLASS);
    for (const x of [-1, 1]) {
      B([x * 0.95, 0.05, -1.9], [0.62, 1.05, 2.2], body, { shape: { cap: [0.31, 0.3] }, tex: camo ? 80 + camo : 65 });   // intakes
      B([x * 0.98, 0.05, -3.0], [0.5, 0.85, 0.05], [0.03, 0.03, 0.035], {});
      B([x * 2.45, 0.55, 0.7], [4.2, 0.16, 2.6], body, { r: [0, 0, x * -0.1], shape: 0.06, tex: camo ? 80 + camo : 65 });  // wings, drooping a little
      B([x * 4.5, -0.25, 1.0], [0.1, 0.9, 0.1], GUNM, { mat: 'metal' });                                         // outrigger wheels
      B([x * 4.5, -0.75, 1.0], [0.16, 0.36, 0.36], DARK, { shape: 'cyl', r: [0, Math.PI / 2, 0], mat: 'rubber' });
      B([x * 4.62, 0.36, 0.9], [0.1, 0.1, 0.1], x < 0 ? [1, 0.1, 0.05] : [0.1, 1, 0.2], { em: 1, shape: 'sphere' });
      B([x * 1.4, 0.45, 6.6], [2.2, 0.08, 1.1], trim, { r: [0, 0, x * -0.12], shape: 0.03 });                  // tail plane
      // the nozzles: pointing down when slow, back when fast
      const tilt = st.tk != null ? st.tk : clamp(((st.vs || 0) - 6) / 30, 0, 1), th = (1 - tilt) * Math.PI / 2;
      for (const z of [-0.9, 1.3]) {
        B([x * 1.05, -0.45, z], [0.5, 0.5, 0.8], GUNM, { r: [th, 0, 0], shape: 'cyl', mat: 'metal' });
        if ((st.rpm || 0) > 0.3) B([x * 1.05, -0.45 - Math.sin(th) * 0.5, z + Math.cos(th) * 0.5], [0.36, 0.36, 0.05], [1, 0.55, 0.2], { r: [th, 0, 0], shape: 'cyl', em: 0.5 + (st.rpm || 0) * 0.4 + (st.boost || 0) * 0.5 });
      }
    }
    B([0, 1.25, 6.2], [0.12, 1.7, 1.7], body, { r: [-0.5, 0, 0], shape: 0.05, tex: camo ? 80 + camo : 65 });     // fin
    B([0, -0.95, -2.8], [0.08, 0.95, 0.08], GUNM, { mat: 'metal' });                                               // nose wheel
    B([0, -1.62, -2.8], [0.18, 0.5, 0.5], DARK, { shape: 'cyl', r: [0, Math.PI / 2, 0], mat: 'rubber' });
    for (const z of [2.2, 2.7]) { B([0, -1.1, z], [0.12, 0.9, 0.12], GUNM, { mat: 'metal' }); B([0, -1.62, z], [0.2, 0.55, 0.55], DARK, { shape: 'cyl', r: [0, Math.PI / 2, 0], mat: 'rubber' }); }
    B([0, 0.2, 7.35], [0.25, 0.25, 0.3], GUNM, { shape: 'cyl', mat: 'metal' });                                  // tail puffer
    B([0, -0.15, -6.9], [0.04, 0.04, 0.8], STEEL, { shape: 'cyl', mat: 'steel' });                                // nose probe
    strobe([0, 2.05, 6.8]);
    if (paint.stripe) B([0, 0.75, 2.5], [0.03, 0.2, 4.5], paint.stripe, { em: glow ? 0.8 : 0 });
  } else if (kind === 'alligator') {
    // ALLIGATOR: a heavy attack helicopter with two rotors stacked on one mast (so no tail rotor), two pilots side by
    // side under one canopy, stub wings with six pylons, a twin-fin tail and wheels
    M('h_alligator'); M('g_alligator_c', GLASS);
    B([0, 0.72, -0.2], [1.1, 0.7, 2.6], body, { shape: 0.3, tex: camo ? 80 + camo : 65 });                      // engine hump
    for (const x of [-1, 1]) {
      B([x * 0.85, 0.65, 0.3], [0.45, 0.45, 1.6], body, { shape: 'cyl', tex: camo ? 80 + camo : 65 });
      B([x * 0.85, 0.65, 1.12], [0.34, 0.34, 0.05], [1, 0.45, 0.15], { shape: 'cyl', em: 0.3 + (st.rpm || 0) * 0.3 });
      B([x * 1.7, -0.15, -0.6], [2.0, 0.14, 1.0], trim, { r: [0, 0, x * -0.06], shape: 0.05 });                     // stub wings
      for (const wx of [1.2, 1.85, 2.5]) B([x * wx, -0.32, -0.6], [0.1, 0.22, 0.55], GUNM, { mat: 'metal' });
      B([x * 2.75, -0.15, -0.6], [0.1, 0.1, 0.1], x < 0 ? [1, 0.1, 0.05] : [0.1, 1, 0.2], { em: 1, shape: 'sphere' });
      B([x * 1.1, 0.85, 6.5], [0.1, 1.2, 0.8], body, { r: [-0.2, 0, 0], shape: 0.04, tex: camo ? 80 + camo : 65 });   // twin fins
      B([x * 0.9, -1.25, -1.0], [0.1, 0.7, 0.1], GUNM, { mat: 'metal' });
      B([x * 0.95, -1.62, -1.0], [0.24, 0.6, 0.6], DARK, { shape: 'cyl', r: [0, Math.PI / 2, 0], mat: 'rubber' });
    }
    B([0, 0.45, 6.5], [2.4, 0.08, 0.7], trim, { shape: 0.03 });
    B([0, 0.6, 7.0], [0.12, 0.7, 0.6], body, { r: [-0.3, 0, 0], shape: 0.04 });
    B([0, -0.9, 5.8], [0.08, 0.7, 0.08], GUNM, { mat: 'metal' });
    B([0, -1.62, 5.8], [0.18, 0.4, 0.4], DARK, { shape: 'cyl', r: [0, Math.PI / 2, 0], mat: 'rubber' });
    strobe([0, 1.5, 7.0]);
    if (paint.stripe) B([0, 0.2, 3.6], [0.5, 0.55, 0.36], paint.stripe, { shape: 0.2, em: glow ? 0.8 : 0 });
  } else if (kind === 'skycrane') {
    // SKYCRANE: a flying crane. A glass cab at the front, a thin spine, four long legs, and a box pod for people
    // slung underneath. Six blades.
    M('h_skycrane'); M('g_skycrane', GLASS);
    B([0, 1.25, 0.6], [1.5, 0.9, 4.4], body, { shape: 0.25, tex: camo ? 80 + camo : 65 });                      // engine deck
    for (const x of [-1, 1]) {
      B([x * 0.5, 1.25, 2.9], [0.4, 0.4, 0.5], GUNM, { shape: 'cyl', mat: 'metal' });
      B([x * 0.5, 1.25, 3.16], [0.3, 0.3, 0.03], [1, 0.45, 0.15], { shape: 'cyl', em: 0.3 + (st.rpm || 0) * 0.3 });
      for (const z of [-3.0, 3.3]) {
        // the long legs: a strut out and down to a wheel
        B([x * 1.6, -0.65, z], [0.14, 2.6, 0.14], GUNM, { r: [0, 0, x * 0.45], mat: 'metal' });
        B([x * 2.15, -1.62, z], [0.3, 0.6, 0.6], DARK, { shape: 'cyl', r: [0, Math.PI / 2, 0], mat: 'rubber' });
      }
      B([x * 1.25, -0.25, 0.15], [0.03, 1.4, 1.1], [0.05, 0.05, 0.06], { mat: 'metal' });                      // pod door
      for (let k = 0; k < 3; k++) B([x * 1.26, 0.3, -1.3 + k * 1.4], [0.02, 0.36, 0.5], GLASS, { mat: 'glass' });
    }
    B([0, -0.35, 0.2], [2.4, 1.9, 4.6], trim, { shape: 0.12 });                                                    // the people pod
    B([0, 0.7, 0.2], [0.3, 0.3, 3.6], GUNM, { mat: 'metal' });                                                    // pod hardpoints
    B([0, 1.75, 9.45], [0.14, 1.9, 1.1], body, { r: [-0.3, 0, 0], shape: 0.05, tex: camo ? 80 + camo : 65 });
    B([0.6, 2.4, 9.3], [1.3, 0.07, 0.5], trim, { shape: 0.03 });
    tailRotor(0.32, 2.25, 9.65, 1.05);
    strobe([0, 2.7, 9.9]);
    if (paint.stripe) B([0, -0.35, 0.2], [2.43, 0.2, 4.0], paint.stripe, { em: glow ? 0.8 : 0 });
  } else if (kind === 'warthog') {
    // WARTHOG: a straight-winged attack plane: two big engines on pods high on the back, twin fins, the long cannon
    // sticking out under the nose, wheels in fairings under the wing
    M('h_warthog'); M('g_warthog_c', GLASS);
    B([0, -0.35, 0.3], [15.2, 0.24, 2.4], body, { shape: 0.06, tex: camo ? 80 + camo : 65 });                    // the wing
    for (const x of [-1, 1]) {
      M('h_engine_pod', body, { p: [x * 1.35, 0.95, 3.1] });
      B([x * 1.35, 0.95, 1.62], [0.9, 0.9, 0.06], DARK, { shape: 'cyl' });                                         // intake
      for (let k = 0; k < 5; k++) B([x * 1.35, 0.95, 1.6], [0.05, 0.85, 0.05], GUNM, { r: [0, 0, (st.rotorA || 0) * 3 + k * 1.26], mat: 'metal' });   // fan blades
      B([x * 1.35, 0.95, 4.62], [0.5, 0.5, 0.04], [1, 0.45, 0.15], { shape: 'cyl', em: 0.3 + (st.rpm || 0) * 0.3 + (st.boost || 0) * 0.6 });
      B([x * 1.0, 0.55, 3.1], [0.18, 0.55, 1.2], body, { shape: 0.04 });                                          // pylon
      B([x * 2.7, 1.2, 7.0], [0.14, 1.9, 1.3], body, { shape: 0.05, tex: camo ? 80 + camo : 65 });                 // twin fins
      B([x * 3.0, -0.65, 0.4], [0.55, 0.75, 2.2], body, { shape: 0.3 });                                          // gear fairings
      B([x * 3.0, -1.5, 0.2], [0.24, 0.6, 0.6], DARK, { shape: 'cyl', r: [0, Math.PI / 2, 0], mat: 'rubber' });
      for (const wx of [1.6, 3.8, 5.2, 6.4]) B([x * wx, -0.6, 0.4], [0.1, 0.24, 0.8], GUNM, { mat: 'metal' });
      B([x * 7.6, -0.32, 0.3], [0.1, 0.1, 0.1], x < 0 ? [1, 0.1, 0.05] : [0.1, 1, 0.2], { em: 1, shape: 'sphere' });
    }
    B([0, 0.6, 7.0], [5.6, 0.1, 1.4], trim, { shape: 0.03 });                                                       // tail plane
    // the GAU-8: seven barrels poking out of the nose
    B([0, -0.55, -6.9], [0.36, 0.36, 1.0], GUNM, { shape: 'cyl', mat: 'metal' });
    for (let i = 0; i < 7; i++) { const a = (st.spin || 0) + i * 0.9; B([Math.cos(a) * 0.11, -0.55 + Math.sin(a) * 0.11, -7.45], [0.05, 0.05, 0.4], STEEL, { shape: 'cyl', mat: 'steel' }); }
    B([0, -0.9, -4.6], [0.1, 0.8, 0.1], GUNM, { mat: 'metal' });
    B([0, -1.62, -4.6], [0.2, 0.55, 0.55], DARK, { shape: 'cyl', r: [0, Math.PI / 2, 0], mat: 'rubber' });
    strobe([0, 2.2, 7.3]);
    if (paint.stripe) B([0, 0.4, 2.0], [0.03, 0.2, 6.0], paint.stripe, { em: glow ? 0.8 : 0 });
  } else if (kind === 'spectre') {
    // SPECTRE: a four-engine gunship: a high wing with four propellers, a tall swept fin, sponsons for the wheels,
    // and a row of guns pointing out of the left side
    M('h_spectre'); M('g_spectre', GLASS);
    B([0, 1.7, -1.0], [30, 0.36, 3.0], body, { shape: 0.06, tex: camo ? 80 + camo : 65 });                       // the wing
    B([0, 1.65, -1.0], [3.2, 0.5, 3.6], body, { shape: 0.3 });
    for (const x of [-1, 1]) {
      for (const ex of [4.6, 9.2]) {
        const ex2 = x * ex;
        B([ex2, 1.35, -1.8], [0.9, 1.0, 4.2], body, { shape: { cap: [0.45, 0.4] }, tex: camo ? 80 + camo : 65 });   // engine nacelle
        B([ex2, 1.35, -3.95], [0.42, 0.42, 0.42], STEEL, { shape: 'sphere', mat: 'steel' });                          // spinner
        if ((st.rpm || 0) > 0.3) B([ex2, 1.35, -4.0], [4.0, 4.0, 0.03], [0.15, 0.15, 0.15], { shape: 'cyl', alpha: 0.12 * st.rpm });
        for (let k = 0; k < 2; k++) B([ex2, 1.35, -4.0], [0.28, 3.8, 0.06], DARK, { r: [0, 0, (st.rotorA || 0) * x + k * Math.PI / 2 + ex], mat: 'metal' });
      }
      B([x * 1.85, -1.0, 0.4], [0.7, 1.0, 4.2], body, { shape: 0.3, tex: camo ? 80 + camo : 65 });               // wheel sponsons
      B([x * 1.85, -1.6, -0.6], [0.28, 0.6, 0.6], DARK, { shape: 'cyl', r: [0, Math.PI / 2, 0], mat: 'rubber' });
      B([x * 1.85, -1.6, 1.2], [0.28, 0.6, 0.6], DARK, { shape: 'cyl', r: [0, Math.PI / 2, 0], mat: 'rubber' });
      B([x * 15.0, 1.7, -1.0], [0.12, 0.12, 0.12], x < 0 ? [1, 0.1, 0.05] : [0.1, 1, 0.2], { em: 1, shape: 'sphere' });
    }
    B([0, 3.6, 9.4], [0.2, 3.8, 2.4], body, { r: [-0.4, 0, 0], shape: 0.05, tex: camo ? 80 + camo : 65 });         // the tall fin
    B([0, 2.0, 9.6], [10, 0.14, 2.0], trim, { shape: 0.03 });
    B([0, -1.25, -7.0], [0.1, 0.6, 0.1], GUNM, { mat: 'metal' });
    B([0, -1.62, -7.0], [0.22, 0.6, 0.6], DARK, { shape: 'cyl', r: [0, Math.PI / 2, 0], mat: 'rubber' });
    // the gunship's guns: two cannons and a howitzer sticking out of the left side
    for (const [z, r, L] of [[-4.6, 0.1, 1.4], [-2.6, 0.14, 1.8], [2.2, 0.26, 2.6]]) {
      B([-1.72, -0.2, z], [0.6, r * 3, r * 3], GUNM, { mat: 'metal', shape: 0.05 });
      B([-1.72 - L / 2, -0.2, z], [L, r, r], STEEL, { shape: 'cyl', r: [0, Math.PI / 2, 0], mat: 'steel' });
    }
    strobe([0, 5.5, 10.4]);
    if (paint.stripe) for (const x of [-1.71, 1.71]) B([x, 0.4, -1.0], [0.03, 0.25, 11], paint.stripe, { em: glow ? 0.8 : 0 });
  } else if (kind === 'kestrel') {
    // KESTREL: a big three-engine utility helicopter: long cabin, wheels in sponsons, a tall swept fin
    M('h_kestrel'); M('h_kestrel_cowl'); M('g_kestrel', GLASS);
    for (const x of [-1, 1]) {
      B([x * 1.36, -0.72, 0.9], [0.62, 0.8, 2.8], body, { shape: 0.3 });
      B([x * 1.46, -1.6, 0.9], [0.3, 0.64, 0.64], DARK, { shape: 'cyl', r: [0, Math.PI / 2, 0], mat: 'rubber' });
      for (const z of [-0.2, 1.65]) B([x * 1.3, -0.05, z], [0.03, 1.5, 0.035], DARK, { shape: undefined, mat: 'metal' });
      B([x * 1.25, 0.82, 0.75], [0.05, 0.05, 2.2], GUNM, { shape: undefined, mat: 'metal' });
      B([x * 1.29, -0.98, -4.0], [0.03, 0.04, 0.6], [0.92, 0.9, 0.2], {});
      B([x * 1.6, -0.6, 0.0], [0.1, 0.1, 0.1], x < 0 ? [1, 0.1, 0.05] : [0.1, 1, 0.2], { em: 1, shape: 'sphere' });
    }
    for (const x of [-0.55, 0, 0.55]) {
      B([x, 1.5, 3.05], [0.34, 0.34, 0.4], GUNM, { shape: 'cyl', mat: 'metal' });
      B([x, 1.5, 3.26], [0.24, 0.24, 0.03], [1, 0.45, 0.15], { shape: 'cyl', em: 0.3 + (st.rpm || 0) * 0.3 });
    }
    B([0, -1.25, -4.2], [0.1, 0.7, 0.1], GUNM, { mat: 'metal' });
    B([0, -1.62, -4.2], [0.2, 0.6, 0.6], DARK, { shape: 'cyl', r: [0, Math.PI / 2, 0], mat: 'rubber' });
    B([0, 1.75, 9.72], [0.15, 2.3, 1.3], body, { r: [-0.36, 0, 0], shape: 0.05, tex: camo ? 80 + camo : 65 });
    B([0, 0.82, 9.0], [2.8, 0.09, 0.66], trim, { shape: 0.035 });
    tailRotor(0.32, 2.3, 10.05, 1.05);
    strobe([0, 2.95, 10.1]);
    if (paint.stripe) for (const x of [-1.3, 1.3]) B([x, -0.6, -0.6], [0.03, 0.18, 4.6], paint.stripe, { shape: undefined, em: glow ? 0.9 : 0 });
  } else if (kind === 'viper') {
    // VIPER: a slim attack helicopter: one long tandem canopy, a spine over the engine, stub wings, skids, two blades
    M('h_viper'); M('h_viper_spine'); M('g_viper_c', GLASS);
    for (const z of [-2.6, -1.6]) B([0, 0.42 + (z + 2.6) * 0.06, z], [0.9, 0.08, 0.1], trim, { shape: 0.03 });
    B([0, -0.15, -0.7], [3.6, 0.12, 0.9], trim, { shape: 0.05 });
    for (const x of [-1.6, -1.05, 1.05, 1.6]) B([x, -0.3, -0.7], [0.1, 0.22, 0.55], GUNM, { mat: 'metal' });
    for (const x of [-1, 1]) {
      B([x * 0.52, 0.72, 0.1], [0.2, 0.4, 0.5], [0.03, 0.03, 0.035], { shape: 0.04 });
      B([x * 0.3, 0.68, 2.05], [0.28, 0.28, 0.35], GUNM, { shape: 'cyl', mat: 'metal' });
      B([x * 0.3, 0.68, 2.24], [0.2, 0.2, 0.03], [1, 0.45, 0.15], { shape: 'cyl', em: 0.3 + (st.rpm || 0) * 0.3 });
      B([x * 0.95, -1.85, -0.5], [0.12, 0.12, 4.0], GUNM, { shape: 'cyl', mat: 'metal' });
      B([x * 0.95, -1.74, -2.58], [0.12, 0.12, 0.45], GUNM, { shape: 'cyl', mat: 'metal', r: [-0.7, 0, 0] });
      for (const z of [-1.8, 0.9]) B([x * 0.72, -1.3, z], [0.09, 1.05, 0.09], GUNM, { r: [0, 0, x > 0 ? 0.45 : -0.45], shape: 0.03, mat: 'metal' });
      B([x * 1.85, -0.15, -0.7], [0.1, 0.1, 0.1], x < 0 ? [1, 0.1, 0.05] : [0.1, 1, 0.2], { em: 1, shape: 'sphere' });
    }
    B([0, 0.85, 6.75], [0.13, 1.5, 0.95], body, { r: [-0.3, 0, 0], shape: 0.05, tex: camo ? 80 + camo : 65 });
    B([0, 0.25, 5.4], [1.6, 0.07, 0.42], trim, { shape: 0.03 });
    tailRotor(0.25, 1.3, 6.9, 0.85);
    strobe([0, 1.65, 7.0]);
    if (paint.stripe) B([0, 0.2, 3.4], [0.5, 0.55, 0.36], paint.stripe, { shape: 0.2, em: glow ? 0.8 : 0 });
  }
  // ---- details every airframe gets: a lit dash, pitot tubes, aerials, flashing beacons, intakes
  const BLINK = (st.t * 1.1) % 1 < 0.12 ? 1 : 0.08;
  const D = {
    hornet: { dash: [0, -0.5, -1.75, 1.0], pitot: [0.3, -0.45, -2.1], ae: [[0, 0.85, 1.4], [0, -1.1, -0.3]], bc: [[0, 0.85, 0.45], [0, -1.15, -0.2]], in: [0.5, 0.62, -0.25] },
    reaper: { dash: [0, -0.05, -3.95, 0.7], pitot: [0.25, -0.35, -5.3], ae: [[0, 0.55, 3.0], [0, -0.95, -1.5]], bc: [[0, 1.4, -0.6], [0, -0.98, 0.5]], in: [0.5, 1.1, -1.25] },
    kestrel: { dash: [0, -0.3, -4.2, 1.7], pitot: [0.45, -0.4, -5.5], ae: [[0, 1.35, 3.6], [0, -1.35, -2.0]], bc: [[0, 1.86, 2.5], [0, -1.35, 1.5]], in: [0.85, 1.45, -1.0] },
    viper: { dash: [0, 0.0, -3.6, 0.6], pitot: [0.2, -0.3, -5.0], ae: [[0, 0.5, 3.2], [0, -0.95, -1.8]], bc: [[0, 1.15, -0.2], [0, -0.9, 0.3]], in: [0.45, 0.8, -0.6] },
    huey: { dash: [0, -0.4, -3.4, 1.5], pitot: [0.3, 0.9, -3.4], ae: [[0, 1.2, 3.2], [0, -1.25, -1.5]], bc: [[0, 1.7, 0.6], [0, -1.25, 0.8]], in: [0.7, 1.32, -0.6] },
    seaking: { dash: [0, -0.3, -4.9, 1.7], pitot: [0.5, -0.4, -5.9], ae: [[0, 1.42, 4.2], [0, -1.3, -2.5]], bc: [[0, 2.0, 2.6], [0, -1.32, 1.2]], in: [0.95, 1.6, -1.6] },
    osprey: { dash: [0, -0.3, -5.8, 1.7], pitot: [0.5, -0.3, -6.8], ae: [[0, 1.3, 3.0], [0, -1.25, -3.0]], bc: [[0, 1.75, 2.5], [0, -1.22, 1.5]], in: [0.9, 1.3, -1.6] },
    harrier: { dash: [0, 0.3, -4.2, 0.6], pitot: [0.2, -0.2, -6.0], ae: [[0, 0.75, 1.5], [0, -0.75, 0.0]], bc: [[0, 0.8, 3.0], [0, -0.72, 0.5]], in: [0.3, 0.75, 0.5] },
    alligator: { dash: [0, -0.05, -3.9, 1.2], pitot: [0.3, -0.35, -5.0], ae: [[0, 0.55, 3.0], [0, -0.95, -1.5]], bc: [[0, 1.2, 1.0], [0, -0.98, 0.5]], in: [0.75, 0.75, -0.6] },
    skycrane: { dash: [0, -0.3, -5.2, 1.5], pitot: [0.45, -0.3, -6.0], ae: [[0, 1.2, 4.5], [0, -1.3, -1.0]], bc: [[0, 1.8, 2.8], [0, -1.32, 1.2]], in: [0.75, 1.5, -1.2] },
    warthog: { dash: [0, 0.35, -4.4, 0.7], pitot: [0.35, -0.2, -6.3], ae: [[0, 0.95, 1.0], [0, -0.85, -1.0]], bc: [[0, 0.88, 2.0], [0, -0.86, 1.0]], in: [0.6, 0.3, -1.5] },
    spectre: { dash: [0, -0.2, -8.2, 2.0], pitot: [0.8, -0.3, -9.0], ae: [[0, 1.75, 3.0], [0, -1.6, -3.0]], bc: [[0, 1.9, 2.5], [0, -1.62, 1.5]], in: [1.0, 1.4, -5.0] },
    mule: { dash: [0, -0.2, -7.0, 1.9], pitot: [0.7, -0.6, -7.5], ae: [[0, 1.42, 1.0], [0, -1.52, -3.0]], bc: [[0, 2.25, -5.2], [0, -1.55, 1.5]], in: [0.75, 2.35, 3.6] },
  }[kind];
  if (D) {
    const [dx, dy, dz, dw] = D.dash;
    B([dx, dy, dz], [dw, 0.3, 0.35], [0.08, 0.08, 0.09], { shape: 0.05, mat: 'poly' });
    for (const x of [-dw * 0.28, 0, dw * 0.28]) B([x, dy + 0.18, dz - 0.12], [dw * 0.2, 0.16, 0.03], x ? [0.25, 0.9, 0.45] : [0.95, 0.65, 0.2], { em: 0.75, r: [0.5, 0, 0] });
    for (const sx of [-1, 1]) {
      B([sx * D.pitot[0], D.pitot[1], D.pitot[2]], [0.035, 0.035, 0.7], STEEL, { shape: 'cyl', mat: 'steel' });
      B([sx * D.in[0], D.in[1], D.in[2]], [0.1, 0.36, 0.55], [0.03, 0.03, 0.035], { shape: 0.04 });
      for (let k = 0; k < 3; k++) B([sx * (D.in[0] + 0.06), D.in[1] - 0.12 + k * 0.12, D.in[2]], [0.03, 0.03, 0.52], GUNM, { mat: 'metal' });
    }
    for (const p of D.ae) B(p, [0.04, 0.36, 0.26], DARK, { r: [p[1] > 0 ? -0.4 : 0.4, 0, 0] });
    for (const p of D.bc) B(p, [0.14, 0.1, 0.14], [1, 0.12, 0.08], { em: BLINK, shape: 'sphere' });
  }
  if (kind === 'mule') for (const x of [-1, 1]) {
    for (let k = 0; k < 5; k++) B([x * 1.49, -0.15, -4.3 + k * 1.75], [0.03, 1.9, 0.05], trim, {});            // fuselage frames
    B([x * 1.5, -0.95, -5.6], [0.04, 0.95, 0.8], [0.92, 0.9, 0.2], {});                                     // the crew door
  }
  if (kind === 'reaper') for (const x of [-1, 1]) {
    B([x * 0.45, -0.6, -3.6], [0.04, 0.08, 0.6], [0.92, 0.9, 0.2], {});
    B([x * 0.85, 1.02, 1.75], [0.5, 0.03, 0.7], [0.06, 0.055, 0.05], { alpha: 0.5 });
  }
  void add; void eq;
}

// ---------------------------------------------------------------- flight
const G = 9.8;
// collision spheres in the local frame: [x, y, z, radius]
const BODIES = {
  warhorse: [[0, 0, 0.2, 1.35], [0, -0.3, -2.8, 1.0], [0, 0.45, 3.6, 0.55], [0, 0.5, 6.2, 0.45], [0, 1.3, 7.9, 0.6], [0, 1.4, 0.6, 0.8]],
  hornet: [[0, -0.3, -0.55, 1.1], [0, 0.25, 2.4, 0.32], [0, 0.6, 4.4, 0.5]],
  reaper: [[0, -0.2, -1.2, 0.9], [0, -0.3, -3.8, 0.8], [0, 0.2, 3.4, 0.5], [0, 0.8, 6.4, 0.6], [0, 0.9, 0.2, 0.75]],
  kestrel: [[0, 0, -0.5, 1.45], [0, 0, 1.8, 1.45], [0, -0.3, -3.8, 1.1], [0, 0.5, 4.8, 0.6], [0, 0.65, 7.5, 0.45], [0, 1.5, 9.8, 0.6], [0, 1.6, 0, 0.9]],
  viper: [[0, -0.2, -1.0, 0.75], [0, -0.25, -3.6, 0.65], [0, 0.15, 3.4, 0.42], [0, 0.6, 6.4, 0.5], [0, 0.75, 0, 0.6]],
  huey: [[0, 0, -2.8, 1.15], [0, 0, -0.4, 1.3], [0, 0.45, 3.4, 0.55], [0, 0.55, 6.0, 0.45], [0, 1.1, 8.1, 0.6], [0, 1.35, 0.3, 0.8]],
  seaking: [[0, 0, -4.4, 1.35], [0, 0, -1.6, 1.4], [0, 0, 1.4, 1.4], [0, 0.4, 4.3, 1.0], [0, 0.8, 7.4, 0.55], [0, 1.5, 10.1, 0.6], [0, 1.75, 0, 0.9]],
  osprey: [[0, 0, -5.0, 1.3], [0, 0, -2.0, 1.3], [0, 0, 1.2, 1.3], [0, 0.3, 4.4, 1.2], [0, 1.2, 6.9, 0.8], [-7.1, 1.55, -0.2, 0.8], [7.1, 1.55, -0.2, 0.8], [-3.6, 1.55, -0.2, 0.5], [3.6, 1.55, -0.2, 0.5]],
  harrier: [[0, 0, -4.2, 0.75], [0, 0, -1.5, 0.95], [0, 0.1, 1.5, 0.9], [0, 0.3, 4.4, 0.6], [0, 1.0, 6.4, 0.6], [-3.6, 0.45, 0.8, 0.5], [3.6, 0.45, 0.8, 0.5]],
  alligator: [[0, -0.2, -1.2, 0.95], [0, -0.3, -3.6, 0.85], [0, 0.2, 3.4, 0.5], [0, 0.6, 6.4, 0.6], [0, 0.9, 0.2, 0.75], [-2.4, -0.15, -0.6, 0.4], [2.4, -0.15, -0.6, 0.4]],
  skycrane: [[0, 0, -4.8, 1.2], [0, -0.35, 0.2, 1.4], [0, 1.1, 0.6, 0.9], [0, 0.8, 4.6, 0.5], [0, 1.0, 7.2, 0.45], [0, 1.6, 9.4, 0.6]],
  warthog: [[0, 0, -4.4, 0.8], [0, 0, -1.4, 0.9], [0, 0.1, 1.8, 0.85], [0, 0.3, 5.0, 0.6], [0, 1.0, 7.0, 0.7], [-6.0, -0.35, 0.3, 0.5], [6.0, -0.35, 0.3, 0.5], [-3.0, -0.35, 0.3, 0.5], [3.0, -0.35, 0.3, 0.5]],
  spectre: [[0, 0, -7.0, 1.6], [0, 0, -3.5, 1.7], [0, 0, 0, 1.7], [0, 0.1, 3.5, 1.7], [0, 0.8, 7.5, 1.1], [0, 3.0, 9.6, 1.0], [-12, 1.7, -1.0, 0.8], [12, 1.7, -1.0, 0.8], [-6.5, 1.7, -1.0, 0.8], [6.5, 1.7, -1.0, 0.8]],
  mule: [[0, 0, -5.4, 1.5], [0, 0, -2.0, 1.5], [0, 0, 1.4, 1.5], [0, 0.2, 4.8, 1.5], [0, 2.1, 4.8, 1.0]],
};
const SKIDSETS = {
  warhorse: [[-1.25, -1.92, -1.9], [1.25, -1.92, -1.9], [-1.25, -1.92, 2.4], [1.25, -1.92, 2.4]],
  hornet: [[-1.0, -1.92, -1.6], [1.0, -1.92, -1.6], [-1.0, -1.92, 1.0], [1.0, -1.92, 1.0]],
  reaper: [[-1.2, -1.92, -1.9], [1.2, -1.92, -1.9], [-0.2, -1.92, 5.4], [0.2, -1.92, 5.4]],
  kestrel: [[-1.46, -1.92, 0.9], [1.46, -1.92, 0.9], [-0.2, -1.92, -4.2], [0.2, -1.92, -4.2]],
  viper: [[-0.95, -1.92, -2.2], [0.95, -1.92, -2.2], [-0.95, -1.92, 1.2], [0.95, -1.92, 1.2]],
  huey: [[-1.3, -1.92, -2.2], [1.3, -1.92, -2.2], [-1.3, -1.92, 1.6], [1.3, -1.92, 1.6]],
  seaking: [[-1.62, -1.92, 0.3], [1.62, -1.92, 0.3], [-0.2, -1.92, -4.6], [0.2, -1.92, -4.6]],
  osprey: [[-1.5, -1.92, 0.0], [1.5, -1.92, 0.0], [-0.2, -1.92, -5.4], [0.2, -1.92, -5.4]],
  harrier: [[-4.5, -1.92, 1.0], [4.5, -1.92, 1.0], [-0.2, -1.92, -2.8], [0.2, -1.92, 2.45]],
  alligator: [[-0.95, -1.92, -1.0], [0.95, -1.92, -1.0], [-0.2, -1.92, 5.8], [0.2, -1.92, 5.8]],
  skycrane: [[-2.15, -1.92, -3.0], [2.15, -1.92, -3.0], [-2.15, -1.92, 3.3], [2.15, -1.92, 3.3]],
  warthog: [[-3.0, -1.92, 0.2], [3.0, -1.92, 0.2], [-0.2, -1.92, -4.6], [0.2, -1.92, -4.6]],
  spectre: [[-1.85, -1.92, -0.6], [1.85, -1.92, 1.2], [-0.2, -1.92, -7.0], [0.2, -1.92, -7.0]],
  mule: [[-1.4, -1.92, -4.3], [1.4, -1.92, -4.3], [-1.4, -1.92, 3.6], [1.4, -1.92, 3.6]],
};

const WATER_TOP = { water: true, min: [-1e6, -1e4, -1e6], max: [1e6, WATER, 1e6] };
export class Chopper {
  constructor() { this.reset([0, 0, 0], 0, {}); }

  reset(pos, yaw, stats) {
    this.pos = [...pos];
    this.vel = [0, 0, 0];
    this.q = qaxis([0, 1, 0], yaw);
    this.w = [0, 0, 0];
    this.rpm = 0;
    this.rotorA = 0; this.tailA = 0;
    this.stats = stats;
    this.landed = null;     // the box it's sitting on
    this.contacts = 0;
    this.boostT = 1;        // afterburner fuel
    this.thr = 0;           // a plane's throttle
    this.planeMode = !!(stats && stats.plane && !stats.vtol); this.tiltK = this.planeMode ? 1 : 0;
    this.boost = 0;
    this.stickP = 0; this.stickR = 0;
    this.dead = false;
    this.spinOut = 0;
    this.extraMass = 0;      // zombies hanging off the skids
    this.events = [];
    this.H = mat4();
    this.m = mat4();
    qmat(this.H, this.q, this.pos);
  }

  get fwd() { return qrot(this.q, [0, 0, -1]); }
  get up() { return qrot(this.q, [0, 1, 0]); }
  get right() { return qrot(this.q, [1, 0, 0]); }
  toWorld(p) { const r = qrot(this.q, p); return [r[0] + this.pos[0], r[1] + this.pos[1], r[2] + this.pos[2]]; }
  get pitch() { return Math.asin(clamp(this.fwd[1], -1, 1)); }
  get rollL() { return Math.asin(clamp(this.right[1], -1, 1)); }
  get heading() { const f = this.fwd; return Math.atan2(-f[0], -f[2]); }

  // ctl: { coll -1..1, yaw -1..1 (+ = left), mx, my (mouse pixels), pk, rk (keys -1..1), boost, assist, sens, invert }
  step(dt, ctl, world) {
    const n = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / n;
    for (let i = 0; i < n; i++) this.sub(h, ctl, world, i === 0);
    qmat(this.H, this.q, this.pos);
  }

  sub(dt, ctl, world, first) {
    const S = this.stats, ag = S.agility || 1;
    // planes fly on their wings. A VTOL (Harrier, Osprey) switches between that and hovering like a helicopter (V)
    if (S.vtol) this.tiltK = clamp((this.tiltK || 0) + ((this.planeMode ? 1 : 0) - (this.tiltK || 0) > 0 ? 1 : -1) * dt * 0.3, 0, 1);
    if (S.plane && (!S.vtol || this.planeMode)) { this.planeSub(dt, ctl, world, first); return; }
    const assist = ctl.assist || ctl.mode === 'easy';
    // rotor spin
    const want = this.dead ? 0.55 : ctl.noFuel ? 0.62 : ctl.engineOn ? 1 : 0;
    this.rpm += (want - this.rpm) * damp(this.dead ? 0.6 : 0.9, dt);
    this.rotorA += this.rpm * 26 * dt; this.tailA += this.rpm * 70 * dt;

    // --- rotation
    // FLIGHT ASSIST: the mouse moves a "stick" that sets how far to tip (pitch) and lean (roll); the helicopter tips to
    // match and holds it. Roll eases back to level when you stop moving the mouse. Without assist the mouse sets the
    // turn rate directly, like Battlefield (and nothing levels you out).
    // Mouse forward = nose down (fly forward), like a joystick. INVERT MOUSE flips that.
    const w = this.w;
    const inv = ctl.invert ? -1 : 1, pitch = this.pitch, roll = this.rollL;
    const hs0 = Math.hypot(this.vel[0], this.vel[2]);
    if (ctl.mode === 'easy') {
      // EASY: the mouse steers (left / right turns the nose, forward / back flies forward / back), A / D slide sideways.
      // It banks into turns by itself and eases back to a hover when you let go.
      if (first) {
        const k = 0.0021 * (ctl.sens || 1);
        this.stickP = clamp((this.stickP || 0) + ctl.my * k * inv, -0.5, 0.42);
        this.yawAcc = clamp((this.yawAcc || 0) - ctl.mx * 0.0034 * (ctl.sens || 1), -1.2, 1.2);
      }
      this.stickP = clamp(this.stickP + ctl.pk * 0.9 * dt, -0.5, 0.42);
      this.yawAcc = clamp(this.yawAcc - ctl.rk * 1.8 * dt, -1.2, 1.2);
      this.stickP *= Math.exp(-0.08 * dt);
      const wyT = clamp(this.yawAcc * 7, -2.2, 2.2) * ag;
      this.yawAcc -= wyT * dt;
      this.stickR = (this.dead ? 0.3 : ctl.yaw * 0.4) + wyT * 0.2 * clamp(hs0 / 14, 0.2, 1);
      if (this.dead) this.stickP = 0.1;
      w[0] += ((this.stickP - pitch) * 4.5 * ag - w[0]) * damp(9, dt);
      w[2] += ((this.stickR - roll) * 4.5 * ag - w[2]) * damp(9, dt);
      w[1] += ((this.dead ? 3.2 : wyT) - w[1]) * damp(10, dt);
    } else if (assist) {
      if (first) {
        const k = 0.0022 * (ctl.sens || 1);
        this.stickP = clamp((this.stickP || 0) + ctl.my * k * inv, -0.75, 0.6);
        this.stickR = clamp((this.stickR || 0) - ctl.mx * k, -0.95, 0.95);
      }
      this.stickP = clamp(this.stickP + ctl.pk * 1.1 * dt, -0.75, 0.6);
      this.stickR = clamp(this.stickR - ctl.rk * 1.6 * dt, -0.95, 0.95);
      this.stickR *= Math.exp(-(ctl.mx || ctl.rk ? 0.3 : 1.4) * dt);
      this.stickP *= Math.exp(-0.08 * dt);
      if (this.dead) { this.stickP = 0.1; this.stickR = 0.3; }
      const tp = (this.stickP - pitch) * 4.5 * ag, tr = (this.stickR - roll) * 4.5 * ag;
      w[0] += (tp - w[0]) * damp(9, dt);
      w[2] += (tr - w[2]) * damp(9, dt);
    } else {
      if (first) {
        const k = 0.0058 * (ctl.sens || 1) * ag;
        w[0] += ctl.my * k * inv;
        w[2] -= ctl.mx * k;
      }
      w[0] += ctl.pk * 3.2 * ag * dt;
      w[2] -= ctl.rk * 3.2 * ag * dt;
      w[0] -= pitch * 0.6 * dt; w[2] -= roll * 0.6 * dt;
      const dmp = Math.exp(-3.4 * dt);
      w[0] *= dmp; w[2] *= dmp;
      this.stickP = pitch; this.stickR = roll;
    }
    if (ctl.mode !== 'easy') {
      const yawT = ctl.yaw * 1.7 * ag + roll * 1.5 * clamp(hs0 / 22, 0, 1) * (assist ? 1 : 0.6) + (this.dead ? 3.2 : 0);
      w[1] += (yawT - w[1]) * damp(3.8, dt);
    }
    w[0] = clamp(w[0], -3, 3); w[2] = clamp(w[2], -3.5, 3.5);
    const wl = Math.hypot(w[0], w[1], w[2]);
    if (wl > 1e-6) this.q = qnorm(qmul(this.q, qaxis([w[0] / wl, w[1] / wl, w[2] / wl], wl * dt)));

    // --- forces
    const up = this.up, lr = (S.lift || 1) / (S.mass || 1);
    // hover is always 1 g; the engine and weight decide how hard you can climb. Zombies on the skids drag you down.
    let c = ctl.coll;
    if ((assist || ctl.hold) && Math.abs(c) < 0.1) c = clamp(-this.vel[1] * (ctl.hold ? 0.8 : 0.38), -0.45, 0.45);       // hold height
    const comp = assist ? 1 / Math.max(0.62, up[1]) : 1 / Math.max(0.85, up[1]) * 0.35 + 0.65;
    // out of fuel: the rotor windmills (autorotation) and you sink slowly; S sinks faster, W slows it a little
    const T = ctl.noFuel && !this.dead ? G * comp * Math.min(1, this.rpm / 0.62) * (0.84 + 0.1 * ctl.coll - this.extraMass * 0.5)
      : G * this.rpm * this.rpm * comp * (this.dead ? 0.55 : Math.max(0, 1 - this.extraMass + 0.85 * c * lr));
    const a = [up[0] * T, up[1] * T - G, up[2] * T];
    // afterburner
    this.boost += ((ctl.boost && S.boost && this.boostT > 0 && !this.dead ? 1 : 0) - this.boost) * damp(6, dt);
    if (this.boost > 0.05) {
      const f = this.fwd, fl = Math.hypot(f[0], f[2]) || 1;
      a[0] += (f[0] / fl) * 22 * this.boost * (S.boostMul || 1); a[2] += (f[2] / fl) * 22 * this.boost * (S.boostMul || 1);
      this.boostT = Math.max(0, this.boostT - dt * 0.28 * this.boost);
    } else this.boostT = Math.min(1, this.boostT + dt * 0.12);
    // drag: a little linear, mostly quadratic (sets the top speed), and the rotor damps going up and down
    const v = this.vel, sp = Math.hypot(v[0], v[1], v[2]);
    const kq = 0.0017 / ((S.speed || 1) * (S.speed || 1)) * (1 - this.boost * 0.6);
    for (let i = 0; i < 3; i++) a[i] -= v[i] * (0.06 + kq * sp);
    // the autopilot's hover hold: kill the drift and level out
    if (ctl.hold && !this.dead) { a[0] -= v[0] * 1.8; a[2] -= v[2] * 1.8; this.stickP = (this.stickP || 0) * Math.exp(-3 * dt); this.stickR = (this.stickR || 0) * Math.exp(-3 * dt); }
    a[1] -= v[1] * 0.45;
    for (let i = 0; i < 3; i++) { v[i] += a[i] * dt; this.pos[i] += v[i] * dt; }

    this.collide(dt, world);
  }

  // ---- fixed-wing flight. W / S set the throttle; the mouse pitches and rolls (in EASY it banks you into turns and
  // levels out when you let go); A / D is the rudder. The wings only lift with speed: below the stall speed the nose
  // drops and you sink. The plane flies where it's pointed, and turns by banking.
  planeSub(dt, ctl, world, first) {
    const S = this.stats, ag = S.agility || 1, v = this.vel, w = this.w;
    const want = this.dead ? 0.3 : ctl.noFuel ? 0 : ctl.engineOn ? 1 : 0;
    this.rpm += (want - this.rpm) * damp(1.2, dt);
    this.rotorA += this.rpm * 30 * dt; this.tailA += this.rpm * 70 * dt;
    this.thr = clamp((this.thr ?? 0) + (this.dead ? -1 : ctl.coll) * 0.55 * dt, 0, 1);
    const fwd = this.fwd, up = this.up, right = this.right, sp = Math.hypot(v[0], v[1], v[2]);
    const vf = v[0] * fwd[0] + v[1] * fwd[1] + v[2] * fwd[2], stall = S.stall || 30;
    const k = clamp(vf / stall, 0, 2), auth = clamp(k, 0.2, 1.1), onGround = this.contacts >= 2;
    const easy = ctl.mode === 'easy', assist = ctl.assist || easy, inv = ctl.invert ? -1 : 1;
    // the stick
    if (first) {
      const ks = 0.0026 * (ctl.sens || 1);
      this.stickP = clamp((this.stickP || 0) + ctl.my * ks * inv, -1, 1);
      this.stickR = clamp((this.stickR || 0) - ctl.mx * ks * (easy ? 1.2 : 1), -1, 1);
    }
    this.stickP = clamp(this.stickP + ctl.pk * 1.4 * dt, -1, 1);
    this.stickR = clamp(this.stickR - ctl.rk * 1.6 * dt, -1, 1);
    const roll = this.rollL;
    if (assist) {
      // the stick sets a climb / dive angle and a bank angle; the bank eases back to level when you let go, and the
      // plane turns the way it's banked
      this.stickP *= Math.exp(-0.25 * dt); this.stickR *= Math.exp(-(ctl.mx || ctl.rk ? 0.2 : 0.9) * dt);
      const bank = this.stickR * 1.3, pitchT = clamp(this.stickP * 1.1, -1.1, 1.1) + Math.abs(Math.sin(roll)) * 0.12;
      w[2] += ((bank - roll) * 3.2 * ag * auth - w[2]) * damp(8, dt);
      w[0] += ((pitchT - this.pitch) * 2.6 * ag * auth - w[0]) * damp(8, dt);
    } else {
      this.stickP *= Math.exp(-3 * dt); this.stickR *= Math.exp(-3 * dt);
      w[2] += (this.stickR * 2.6 * ag * auth - w[2]) * damp(8, dt);
      w[0] += (this.stickP * 1.6 * ag * auth - w[0]) * damp(8, dt);
    }
    // rudder, and the nose weathervaning into the airflow (that's what makes it turn when it banks)
    let wy = ctl.yaw * 0.7 * auth;
    if (sp > 4 && !onGround) {
      const l = qrot([-this.q[0], -this.q[1], -this.q[2], this.q[3]], v);
      wy -= (l[0] / sp) * 3.2 * clamp(sp / stall, 0, 1.5);
      if (assist) wy += roll * 0.9 * clamp(k, 0, 1.2) * ag;       // a coordinated turn
    }
    if (onGround) wy = ctl.yaw * 0.9;                      // steer the nose wheel
    w[1] += (wy - w[1]) * damp(6, dt);
    // stalled: the nose drops
    if (!onGround && vf < stall * 0.9 && (!S.vtol || this.tiltK > 0.97)) w[0] -= (1 - vf / (stall * 0.9)) * 2.2 * dt * 8;
    if (this.dead) { w[2] += 2 * dt; w[0] -= 0.6 * dt; }
    w[0] = clamp(w[0], -2.5, 2.5); w[1] = clamp(w[1], -2, 2); w[2] = clamp(w[2], -3.5, 3.5);
    const wl = Math.hypot(w[0], w[1], w[2]);
    if (wl > 1e-6) this.q = qnorm(qmul(this.q, qaxis([w[0] / wl, w[1] / wl, w[2] / wl], wl * dt)));
    // forces: thrust along the nose, lift off the wings (with speed), drag, and the wings resisting moving sideways
    // or up and down through the air
    this.boost += ((ctl.boost && S.boost && this.boostT > 0 && !this.dead ? 1 : 0) - this.boost) * damp(5, dt);
    if (this.boost > 0.05) this.boostT = Math.max(0, this.boostT - dt * 0.12 * this.boost); else this.boostT = Math.min(1, this.boostT + dt * 0.08);
    const T = (S.thrust || 8) * this.thr * this.rpm * (1 + ((S.boostMul || 1) - 1) * this.boost);
    let lift = G * Math.min(1, k * k) * clamp((S.lift || 1) / (S.mass || 1), 0.85, 1.05);
    if (S.vtol) lift = Math.max(lift, G * (1 - (this.tiltK || 0)) * 1.06 + lift * (this.tiltK || 0));     // the nozzles / rotors still holding it up mid-change
    const vr = v[0] * right[0] + v[1] * right[1] + v[2] * right[2], vu = v[0] * up[0] + v[1] * up[1] + v[2] * up[2];
    const a = [0, -G, 0];
    const kq = (S.thrust || 8) / ((S.vmax || 80) * (S.vmax || 80));
    let brake = 0;
    if (ctl.coll < 0 && this.thr <= 0.01 && S.airbrake) brake = onGround && S.airbrake === 2 ? 1.6 : 0.5;
    for (let i = 0; i < 3; i++) {
      a[i] += fwd[i] * T + up[i] * lift;
      a[i] -= v[i] * (kq * sp + 0.01 + brake);
      a[i] -= right[i] * vr * 1.6 * Math.min(1, k + (onGround ? 3 : 0));
      a[i] -= up[i] * vu * 0.9 * Math.min(1, k);
    }
    for (let i = 0; i < 3; i++) { v[i] += a[i] * dt; this.pos[i] += v[i] * dt; }
    this.collide(dt, world);
  }

  collide(dt, world) {
    const v = this.vel;
    this.contacts = 0; let on = null;
    // the skids: stand on whatever is under them
    for (const s of SKIDSETS[this.stats.kind] || SKIDSETS.warhorse) {
      const p = this.toWorld(s);
      const b = world.firstOverlap([p[0] - 0.05, p[1] - 0.05, p[2] - 0.05], [p[0] + 0.05, p[1] + 0.05, p[2] + 0.05])
        || (this.stats.floats && p[1] < WATER + 0.05 ? WATER_TOP : null);
      if (!b) continue;
      const pen = b.max[1] - p[1];
      if (pen > 1.0) continue;              // that's a wall, not a floor: the body spheres deal with it
      if (pen > 0) this.pos[1] += pen * 0.5;
      this.contacts++; on = b;
      if (v[1] < 0) {
        const lim = this.stats.gear ? 12 : 7.5;
        if (-v[1] > lim) this.events.push({ type: 'impact', speed: -v[1] - lim, point: p, hard: true });
        v[1] = 0;
      }
    }
    const rolling = this.stats.plane && (!this.stats.vtol || this.planeMode);
    if (this.contacts && rolling) {
      const f = Math.exp(-(this.thr <= 0.01 ? 0.9 : 0.04) * dt);
      v[0] *= f; v[2] *= f;
      this.w[0] *= Math.exp(-8 * dt); this.w[2] *= Math.exp(-8 * dt);
      this.w[2] -= this.rollL * 6 * dt;
      if (this.pitch < -0.05) this.w[0] -= this.pitch * 6 * dt;
    } else if (this.contacts) {
      const f = Math.exp(-5 * dt);
      v[0] *= f; v[2] *= f;
      this.w[0] *= Math.exp(-8 * dt); this.w[2] *= Math.exp(-8 * dt);
      // settle level on the ground
      this.w[0] -= this.pitch * 6 * dt; this.w[2] -= this.rollL * 6 * dt;
    }
    this.landed = this.contacts >= 3 && Math.hypot(v[0], v[1], v[2]) < 3 ? on : null;
    // the body: push out of buildings, and hurt
    for (const [x, y, z, r] of BODIES[this.stats.kind] || BODIES.warhorse) {
      const p = this.toWorld([x, y, z]);
      for (let it = 0; it < 2; it++) {
        const b = world.firstOverlap([p[0] - r, p[1] - r, p[2] - r], [p[0] + r, p[1] + r, p[2] + r]);
        if (!b) break;
        const c = [clamp(p[0], b.min[0], b.max[0]), clamp(p[1], b.min[1], b.max[1]), clamp(p[2], b.min[2], b.max[2])];
        let d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]], dl = Math.hypot(d[0], d[1], d[2]), nrm, depth;
        if (dl > 1e-4) { if (dl >= r) break; nrm = d.map((q) => q / dl); depth = r - dl; } else {
          // centre inside: out along the shortest way
          let best = Infinity; nrm = [0, 1, 0];
          for (let ax = 0; ax < 3; ax++) for (const sg of [-1, 1]) {
            const dd = sg > 0 ? b.max[ax] - p[ax] : p[ax] - b.min[ax];
            if (dd < best) { best = dd; nrm = [0, 0, 0]; nrm[ax] = sg; }
          }
          depth = best + r;
        }
        for (let i = 0; i < 3; i++) { this.pos[i] += nrm[i] * depth; p[i] += nrm[i] * depth; }
        const vn = v[0] * nrm[0] + v[1] * nrm[1] + v[2] * nrm[2];
        if (vn < 0) {
          if (-vn > 5 && !(nrm[1] > 0.7 && this.contacts)) this.events.push({ type: 'impact', speed: -vn - 5, point: c, normal: nrm });
          for (let i = 0; i < 3; i++) v[i] -= nrm[i] * vn * 1.3;
        }
      }
    }
    // the rotor tips hitting walls
    if (this.rpm > 0.3) {
      const [, R0, hy0] = ROTOR[(this.stats.rotorTier) || 0];
      hubs: for (const [hy1, hz, rs] of (AIRFRAMES[this.stats.kind] || AIRFRAMES.warhorse).hubs) {
        const hy = hy1 ?? hy0, R = R0 * rs;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const p = this.toWorld([Math.sin(a) * R * 0.95, hy, hz + Math.cos(a) * R * 0.95]);
          if (!world.pointInside(p)) continue;
          const c = this.toWorld([0, hy, hz]), d = [c[0] - p[0], 0, c[2] - p[2]], dl = Math.hypot(d[0], d[2]) || 1;
          v[0] += (d[0] / dl) * 9 * dt * 10; v[2] += (d[2] / dl) * 9 * dt * 10;
          this.events.push({ type: 'rotor', point: p });
          break hubs;
        }
      }
    }
  }
}
