// DEAD AIR: the giants. Each one is built from parts in its own local frame (units: a normal zombie is ~1.9 tall;
// the boss's size z.s scales everything), with simple two-bone legs and arms so they really walk, knuckle along,
// throw and spit. Forward is -z in the local frame (the same as the zombies).

const SKIN = {
  goliath: { skin: [0.55, 0.47, 0.43], dark: [0.32, 0.27, 0.26], flesh: [0.52, 0.1, 0.09], bone: [0.86, 0.82, 0.7], eye: [1, 0.35, 0.08] },
  spitter: { skin: [0.46, 0.5, 0.32], dark: [0.27, 0.31, 0.18], flesh: [0.45, 0.16, 0.1], bone: [0.8, 0.8, 0.62], eye: [0.7, 1, 0.2] },
  mother: { skin: [0.76, 0.6, 0.58], dark: [0.45, 0.3, 0.32], flesh: [0.6, 0.15, 0.14], bone: [0.85, 0.8, 0.72], eye: [1, 0.8, 0.2] },
};
const CONCRETE = [0.52, 0.51, 0.49], RUST = [0.42, 0.2, 0.09], ACID = [0.55, 1, 0.2], EGG = [1, 0.55, 0.25], HAIR = [0.08, 0.06, 0.06];
const CARS = [[0.6, 0.12, 0.1], [0.15, 0.25, 0.5], [0.75, 0.75, 0.72], [0.12, 0.12, 0.13], [0.8, 0.65, 0.15]];

export function bossParts(z, out, t) {
  const s = z.s, c = Math.cos(z.yaw), sn = Math.sin(z.yaw), K = SKIN[z.type] || SKIN.goliath;
  const flash = z.hitT > 0;
  const tint = (col) => (flash ? [Math.min(1, col[0] + 0.45), Math.min(1, col[1] + 0.35), Math.min(1, col[2] + 0.35)] : col);
  const W = (l) => [z.x + (l[0] * c + l[2] * sn) * s, z.y + l[1] * s, z.z + (-l[0] * sn + l[2] * c) * s];
  const ball = (l, r, col, em = 0) => out.push({ pos: W(l), rot: [0, z.yaw, 0], size: [r[0] * s, r[1] * s, r[2] * s], col: tint(col), em, mesh: 'sphere' });
  const box = (l, sz, rx, col, em = 0, rz = 0, mesh = 'box') => out.push({ pos: W(l), rot: [rx, z.yaw, rz], size: [sz[0] * s, sz[1] * s, sz[2] * s], col: tint(col), em, mesh });
  // a limb or bone from a to b (local points), w x h thick
  const seg = (a, b, w, h, col, mesh = 'cyl', em = 0) => {
    const A = W(a), B = W(b), dx = B[0] - A[0], dy = B[1] - A[1], dz = B[2] - A[2], L = Math.hypot(dx, dy, dz) || 0.001;
    out.push({ pos: [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2], rot: [-Math.asin(dy / L), Math.atan2(dx, dz), 0], size: [w * s, h * s, L + w * s * 0.35], col: tint(col), em, mesh });
  };
  // two-bone reach: the middle joint, bending towards `bend` (a local direction)
  const ik = (a, b, l1, l2, bend) => {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.min(l1 + l2 - 0.001, Math.hypot(d[0], d[1], d[2]) || 0.001);
    const x = (l1 * l1 - l2 * l2 + L * L) / (2 * L), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
    const u = d.map((v) => v / (Math.hypot(d[0], d[1], d[2]) || 1));
    const bd = bend.map((v, i) => v - u[i] * (bend[0] * u[0] + bend[1] * u[1] + bend[2] * u[2])), bl = Math.hypot(...bd) || 1;
    return [a[0] + u[0] * x + bd[0] / bl * h, a[1] + u[1] * x + bd[1] / bl * h, a[2] + u[2] * x + bd[2] / bl * h];
  };
  // a tapering limb from a (radius r0) to b (radius r1): two segments and round joints, so it reads as flesh, not a pipe
  const limb = (a, b, r0, r1, col, joint = true) => {
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rm = (r0 + r1) / 2;
    seg(a, m, (r0 + rm), (r0 + rm), col); seg(m, b, (rm + r1), (rm + r1), col);
    if (joint) ball(a, [r0 * 2.05, r0 * 2.05, r0 * 2.05], col);
  };
  const p = z.bph ?? z.ph, atk = z.atk || 0, br = 1 + Math.sin(t * 1.7) * 0.03;
  const swing = (sd) => Math.sin(p + (sd > 0 ? 0 : Math.PI));
  const lift = (sd) => Math.max(0, Math.cos(p + (sd > 0 ? 0 : Math.PI)));
  const mix = (a, b, k) => a.map((v, i) => v * (1 - k) + b[i] * k);

  if (z.type === 'goliath') {
    const bob = Math.abs(Math.sin(p)) * 0.05, sway = Math.sin(p) * 0.04, mid = mix(K.skin, K.dark, 0.5);
    // legs: short, bowed and massive
    for (const sd of [-1, 1]) {
      const hip = [sd * 0.38, 0.98 - bob, 0.18], foot = [sd * 0.48, 0.1 + lift(sd) * 0.18, 0.12 - swing(sd) * 0.34];
      const knee = ik(hip, foot, 0.52, 0.5, [sd * 0.3, 0, -1]);
      limb(hip, knee, 0.26, 0.2, mid); limb(knee, foot, 0.2, 0.14, K.skin);
      ball([foot[0], foot[1] - 0.02, foot[2] - 0.12], [0.36, 0.16, 0.55], K.dark);
      for (const k of [-1, 0, 1]) ball([foot[0] + k * 0.11, foot[1] - 0.03, foot[2] - 0.38], [0.08, 0.07, 0.1], K.bone);
    }
    // the body: pelvis, gut, a barrel chest pitched forward, a huge hump of muscle behind the head
    ball([sway, 1.0 - bob, 0.15], [0.98, 0.52, 0.66], [0.2, 0.2, 0.23]);
    ball([sway, 1.28 - bob, -0.08], [1.02, 0.78, 0.86], mid);
    ball([sway, 1.58 - bob, -0.32], [1.42, 0.86, 0.98], K.skin);
    ball([sway, 1.86 - bob, 0.06], [1.2, 0.74, 0.92], K.dark);
    for (const sd of [-1, 1]) ball([sd * 0.3 + sway, 1.55 - bob, -0.72], [0.52, 0.42, 0.24], K.skin);            // pecs
    // bone spurs pushing out of the hump, and the city it's been smashing through stuck in its back
    for (let k = 0; k < 5; k++) seg([sway, 1.86 + k * 0.04 - bob, 0.42 - k * 0.14], [sway, 2.12 + k * 0.05 - bob, 0.62 - k * 0.15], 0.08, 0.08, K.bone);
    box([0.34 + sway, 1.98 - bob, 0.32], [0.42, 0.28, 0.32], 0.4, CONCRETE, 0, 0.3);
    for (const [a, b] of [[[0.3, 2.0, 0.4], [0.5, 2.45, 0.7]], [[0.42, 1.95, 0.3], [0.78, 2.28, 0.4]], [[-0.25, 1.85, 0.42], [-0.42, 2.2, 0.75]]]) seg([a[0] + sway, a[1] - bob, a[2]], [b[0] + sway, b[1] - bob, b[2]], 0.04, 0.04, RUST);
    // wounds: open gashes, ribs showing down one side
    ball([0.38 + sway, 1.4 - bob, -0.62], [0.3, 0.26, 0.12], K.flesh);
    ball([-0.2 + sway, 1.15 - bob, -0.5], [0.22, 0.14, 0.1], K.flesh);
    for (let k = 0; k < 4; k++) seg([-0.62 + sway, 1.18 + k * 0.12 - bob, 0.05], [-0.64 + sway, 1.14 + k * 0.12 - bob, -0.4], 0.035, 0.035, K.bone);
    // shoulders and arms: knuckle-walking, the forearms bigger than the upper arms
    for (const sd of [-1, 1]) {
      const sh = [sd * 0.8 + sway, 1.72 - bob, -0.32];
      ball(sh, [0.62, 0.58, 0.62], K.skin);
      let fist = [sd * 0.95, 0.18 + lift(-sd) * 0.22, -0.6 - swing(-sd) * 0.38];
      if (sd > 0 && atk > 0) fist = [0.6, 2.65 + (1 - atk) * 0.15, 0.25 + atk * 0.2];                              // winding up a throw
      const el = ik(sh, fist, 0.78, 0.88, [sd * 1, 0, 0.7]);
      limb(sh, el, 0.24, 0.2, K.skin);
      limb(el, fist, 0.28, 0.24, mid);
      ball(fist, [0.46, 0.4, 0.46], K.dark);
      for (const k of [-1, 0, 1]) ball([fist[0] + k * 0.12, fist[1] - 0.05, fist[2] - 0.2], [0.11, 0.1, 0.11], K.bone);
      if (sd < 0) box([el[0], el[1] - 0.25, el[2] - 0.1], [0.32, 0.4, 0.32], 0.6, CONCRETE, 0, 0.2);
      if (sd > 0 && atk > 0) out.push({ pos: W([0.6, 2.95, 0.3]), rot: [t * 2, z.yaw, 0.6], size: [2.0, 1.4, 4.2], col: CARS[(z.id || 0) % CARS.length], em: 0, mesh: 'box' });
    }
    // the head: low and thrust forward under the hump, a heavy brow, the jaw hanging open
    const hy = 1.62 - bob, hz = -0.98;
    ball([sway, hy, hz], [0.44, 0.44, 0.48], K.skin);
    ball([sway, hy + 0.13, hz - 0.12], [0.42, 0.14, 0.24], K.dark);
    ball([sway, hy - 0.17, hz - 0.06], [0.36, 0.2, 0.34], K.flesh);
    ball([sway, hy - 0.22 - (atk > 0 ? 0.06 : 0), hz - 0.04], [0.34, 0.12, 0.34], K.skin);
    for (const k of [-0.12, -0.04, 0.04, 0.12]) box([k + sway, hy - 0.09, hz - 0.21], [0.04, 0.09, 0.035], 0, K.bone);
    for (const sd of [-1, 1]) ball([sd * 0.11 + sway, hy + 0.04, hz - 0.21], [0.08, 0.055, 0.05], K.eye, 1.2);
    return out;
  }

  if (z.type === 'spitter') {
    const bob = Math.abs(Math.sin(p)) * 0.05;
    // long backward-bending legs
    for (const sd of [-1, 1]) {
      const hip = [sd * 0.24, 1.32 - bob, 0.14], toe = [sd * 0.3, 0.03 + lift(sd) * 0.22, -0.05 - swing(sd) * 0.42];
      const ankle = [toe[0], toe[1] + 0.36, toe[2] + 0.3];
      const knee = ik(hip, ankle, 0.64, 0.68, [0, 0, -1]);
      limb(hip, knee, 0.15, 0.1, K.skin); limb(knee, ankle, 0.09, 0.06, K.dark); limb(ankle, toe, 0.06, 0.04, K.dark, false);
      for (const k of [-1, 0, 1]) seg(toe, [toe[0] + k * 0.1, toe[1] - 0.02, toe[2] - 0.22], 0.035, 0.035, K.bone);
    }
    // a thin, bent body: you can see every rib
    ball([0, 1.36 - bob, 0.12], [0.5, 0.34, 0.38], K.dark);
    ball([0, 1.62 - bob, -0.04], [0.44, 0.6, 0.38], K.skin);
    ball([0, 1.88 - bob, -0.22], [0.58, 0.48, 0.46], K.skin);
    for (let k = 0; k < 5; k++) for (const sd of [-1, 1]) seg([sd * 0.08, 1.58 + k * 0.08 - bob, -0.22 - k * 0.04], [sd * 0.27, 1.6 + k * 0.08 - bob, -0.05 - k * 0.04], 0.03, 0.03, K.bone);
    // the acid sacs on its back, swelling and glowing
    const glow = 0.35 + 0.3 * Math.sin(t * 3) + (atk > 0 ? 0.5 : 0), sw2 = 1 + (atk > 0 ? 0.12 : 0) + Math.sin(t * 3) * 0.05;
    ball([0, 2.02 - bob, 0.28], [0.66 * sw2, 0.58 * sw2, 0.66 * sw2], ACID, glow);
    for (const sd of [-1, 1]) ball([sd * 0.32, 1.76 - bob, 0.4], [0.4 * sw2, 0.36 * sw2, 0.4 * sw2], ACID, glow * 0.8);
    ball([0, 1.7 - bob, 0.55], [0.3 * sw2, 0.3 * sw2, 0.3 * sw2], ACID, glow * 0.7);
    for (const sd of [-1, 1]) for (const k of [0, 1]) seg([sd * 0.1, 1.9 - bob - k * 0.2, 0.0], [sd * (0.2 + k * 0.15), 2.05 - bob - k * 0.25, 0.32 + k * 0.1], 0.035, 0.035, K.dark);
    // a long neck, pulled back to spit, then thrust out
    const pull = atk > 0 ? Math.sin(Math.min(1, atk) * Math.PI) * 0.35 : 0;
    const n0 = [0, 2.0 - bob, -0.42], n1 = [0, 2.22 - bob + pull * 0.3, -0.82 + pull], n2 = [0, 2.08 - bob + pull * 0.2, -1.25 + pull * 1.3];
    limb(n0, n1, 0.13, 0.1, K.skin); limb(n1, n2, 0.1, 0.09, K.skin);
    ball([0, n1[1] - 0.1, n1[2] - 0.04], [0.24 * sw2, 0.2 * sw2, 0.24 * sw2], ACID, glow);                        // throat sac
    ball([0, n2[1] + 0.04, n2[2] - 0.2], [0.26, 0.2, 0.56], K.skin);
    ball([0, n2[1] + 0.12, n2[2] - 0.05], [0.22, 0.14, 0.3], K.dark);
    ball([0, n2[1] - 0.1 - (atk > 0 ? 0.1 : 0), n2[2] - 0.18], [0.22, 0.1, 0.38], K.flesh);
    ball([0, n2[1] - 0.03, n2[2] - 0.3], [0.1, 0.08, 0.12], ACID, 0.5 + glow);
    for (const k of [-0.07, 0, 0.07]) box([k, n2[1] - 0.06, n2[2] - 0.36], [0.025, 0.07, 0.025], 0, K.bone);
    for (const sd of [-1, 1]) ball([sd * 0.1, n2[1] + 0.1, n2[2] - 0.28], [0.06, 0.04, 0.04], K.eye, 1.2);
    // long arms with hooked claws
    for (const sd of [-1, 1]) {
      const sh = [sd * 0.34, 1.92 - bob, -0.32], hand = [sd * 0.46, 0.92 + lift(-sd) * 0.1, -0.55 - swing(-sd) * 0.22];
      const el = ik(sh, hand, 0.58, 0.58, [sd, 0, 0.5]);
      ball(sh, [0.22, 0.2, 0.22], K.skin);
      limb(sh, el, 0.08, 0.065, K.skin); limb(el, hand, 0.065, 0.05, K.skin);
      for (const k of [-1, 0, 1]) seg(hand, [hand[0] + k * 0.06, hand[1] - 0.24, hand[2] - 0.1], 0.03, 0.03, K.bone);
    }
    return out;
  }

  // THE BROODMOTHER: a swollen egg-sac of a body dragged along on spider legs, a woman's torso and arms out front
  const sw = Math.sin(p), pulse = 1 + Math.sin(t * 1.3) * 0.04;
  ball([0, 1.05, 0.9], [1.7 * pulse, 1.35 * pulse, 2.1 * pulse], K.skin);
  ball([0, 1.3, 1.05], [1.3 * pulse, 0.9 * pulse, 1.6 * pulse], mix(K.skin, K.dark, 0.35));
  ball([0, 0.75, 1.75], [0.9, 0.8, 0.7], K.dark);
  // glowing eggs pushing out through the skin
  for (let k = 0; k < 16; k++) {
    const a = k * 2.4, e = 0.3 + (k % 4) * 0.12;
    const l = [Math.cos(a) * 0.72 * (1 - e * 0.4), 0.95 + e * 1.1, 0.9 + Math.sin(a) * 0.85];
    ball(l, [0.2, 0.24, 0.2], EGG, 0.5 + 0.4 * Math.sin(t * 2.2 + k));
  }
  for (let k = 0; k < 6; k++) seg([Math.sin(k * 1.7) * 0.5, 0.55 + k * 0.17, 0.15], [Math.sin(k * 1.7 + 1) * 0.75, 1.0 + k * 0.1, 1.7], 0.03, 0.03, K.flesh);
  // six spider legs
  for (const sd of [-1, 1]) for (const fb of [0, 1, 2]) {
    const ph = p + fb * 2.1 + (sd > 0 ? 0 : Math.PI);
    const hip = [sd * 0.5, 1.05, 0.35 + fb * 0.6], foot = [sd * 1.45, 0.03 + Math.max(0, Math.cos(ph)) * 0.2, 0.15 + fb * 0.8 - Math.sin(ph) * 0.3];
    const knee = [sd * 1.2, 1.7, (hip[2] + foot[2]) / 2];
    limb(hip, knee, 0.09, 0.07, K.dark); limb(knee, foot, 0.07, 0.03, K.dark);
  }
  // the torso, rising out of the front of it
  ball([0, 1.3, -0.15], [0.62, 0.5, 0.5], K.skin);
  ball([0, 1.62, -0.28], [0.7, 0.55, 0.45], K.skin);
  ball([0, 1.88, -0.32], [0.78, 0.32, 0.4], K.skin);
  for (let k = 0; k < 4; k++) for (const sd of [-1, 1]) seg([sd * 0.06, 1.38 + k * 0.1, -0.5], [sd * 0.3, 1.4 + k * 0.1, -0.38], 0.025, 0.025, K.bone);
  // arms clawing it forward
  for (const sd of [-1, 1]) {
    const sh = [sd * 0.4, 1.86, -0.35], hand = [sd * 0.75, 0.06 + Math.max(0, -Math.cos(p + (sd > 0 ? 0 : Math.PI))) * 0.25, -1.1 + Math.sin(p + (sd > 0 ? 0 : Math.PI)) * 0.3];
    const el = ik(sh, hand, 0.78, 0.8, [sd, 0.7, 0]);
    ball(sh, [0.26, 0.24, 0.26], K.skin);
    limb(sh, el, 0.1, 0.08, K.skin); limb(el, hand, 0.08, 0.06, K.skin);
    for (const k of [-1, 0, 1]) seg(hand, [hand[0] + k * 0.09, hand[1] - 0.03, hand[2] - 0.22], 0.035, 0.035, K.bone);
  }
  // the head, long hair hanging over the face, two lights where the eyes should be
  const hy = 2.22 + sw * 0.02;
  ball([0, hy - 0.16, -0.42], [0.14, 0.2, 0.14], K.skin);
  ball([0, hy, -0.5], [0.3, 0.36, 0.32], K.skin);
  for (let k = 0; k < 11; k++) { const a = (k / 10 - 0.5) * 2.6; seg([Math.sin(a) * 0.15, hy + 0.15, -0.5 + Math.cos(a) * 0.1], [Math.sin(a) * 0.24 + Math.sin(t + k) * 0.02, hy - 0.5 - (k % 3) * 0.12, -0.6 + Math.cos(a) * 0.12], 0.05, 0.025, HAIR, 'box'); }
  for (const sd of [-1, 1]) ball([sd * 0.07, hy + 0.02, -0.66], [0.055, 0.035, 0.03], K.eye, 1.2);
  ball([0, hy - 0.12, -0.65], [0.12, 0.08, 0.04], K.flesh);
  return out;
}
