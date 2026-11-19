// DEAD AIR: the forests. Thousands of trees, placed from the seed (so friends see the same ones) wherever the land is
// wooded, but never on roads, in towns, in water or on cliffs. They're worked out 128 m chunk by chunk as you get near,
// drawn as a few instanced batches per chunk (pines, broadleaf, dead ones), and kept as a list so the helicopter can
// hit them (fly into a forest and you'll know).
import { compose, mat4 } from '../math.js';
import { INST_FLOATS } from '../renderer.js';
import { HALF, CH, WATER, rng } from './terrain.js';

const PINE = [[0.1, 0.19, 0.11], [0.12, 0.22, 0.12], [0.09, 0.16, 0.1], [0.14, 0.21, 0.1]];
const LEAF = [[0.2, 0.32, 0.11], [0.26, 0.36, 0.13], [0.17, 0.28, 0.1], [0.3, 0.38, 0.12], [0.22, 0.34, 0.16], [0.24, 0.3, 0.1], [0.36, 0.38, 0.13], [0.5, 0.36, 0.12]];
const BARK = [[0.26, 0.2, 0.15], [0.3, 0.25, 0.19], [0.22, 0.18, 0.14]];

export class Forest {
  constructor(map) {
    this.T = map.terrain; this.ground = map.ground; this.seed = map.seed;
    this.chunks = new Map();          // key -> { list: [{x, y, z, h, r}], batches: [...] | null, center, radius }
    this.box = { solid: true, id: -2, tree: true, color: [0.15, 0.25, 0.1], min: [0, 0, 0], max: [0, 0, 0] };
    this.m = mat4();
    this.data = new Float32Array(INST_FLOATS * 900);
    this.visible = [];
    this.draw = 1100;                 // trees further than this aren't drawn (the haze hides them)
  }
  key(ci, ck) { return ck * 1000 + ci; }

  // where the trees in one chunk stand (no GPU work: used for collisions too)
  plan(ci, ck) {
    const k = this.key(ci, ck);
    let c = this.chunks.get(k);
    if (c) return c;
    const T = this.T, G = this.ground, R = rng((this.seed * 9973 + ci * 7919 + ck * 104729) >>> 0);
    const x0 = -HALF + ci * CH, z0 = -HALF + ck * CH, list = [];
    // jittered grid: one try every 6 m, kept with the chance the forest says
    for (let gz = 0; gz < CH; gz += 7) for (let gx = 0; gx < CH; gx += 7) {
      const x = x0 + gx + R() * 7, z = z0 + gz + R() * 7;
      const f = T.forest(x, z), lone = R();
      if (lone > f * 0.92 && !(lone > 0.995)) continue;              // the odd lone tree out in the fields
      const g = G.at(x, z);
      if (g.road < 9 || g.town > 0.05) continue;
      const y = T.heightAt(x, z);
      if (y < WATER + 1.2 || T.slopeAt(x, z) > 0.42) continue;
      const pine = y > 70 || T.noise(x / 400 + 77, z / 400, 2) > 0.52;
      const h = (pine ? 11 : 9) * (0.7 + R() * 0.65) * (y > 150 ? 0.7 : 1);
      list.push({ x, y, z, h, r: pine ? h * 0.22 : h * 0.33, pine, dead: R() < 0.04, c: R(), yaw: R() * 6.28 });
    }
    c = { list, batches: null, center: [x0 + CH / 2, list.length ? list[0].y + 6 : 0, z0 + CH / 2], radius: CH * 0.75 };
    this.chunks.set(k, c);
    return c;
  }

  build(r, c) {
    const lists = { trunk: [], pine: [], blob: [] };
    const b = { model: null, scale: null, color: null, shape: 'x', tex: 0 };
    for (const t of c.list) {
      lists.trunk.push([t.x, t.y - 0.4, t.z, 0.35 + t.h * 0.025, t.dead ? t.h * 0.9 : t.h * (t.pine ? 0.4 : 0.55), BARK[Math.floor(t.c * 3)], 0]);
      if (t.dead) continue;
      if (t.pine) lists.pine.push([t.x, t.y + t.h * 0.18, t.z, t.r * 2, t.h * 0.85, PINE[Math.floor(t.c * PINE.length)], t.yaw]);
      else lists.blob.push([t.x, t.y + t.h * 0.62, t.z, t.r * 2, t.h * 0.62, LEAF[Math.floor(t.c * (t.y > 60 ? 6 : LEAF.length))], t.yaw]);
    }
    c.batches = []; c.trunks = null;
    for (const [shape, L] of Object.entries(lists)) {
      if (!L.length) continue;
      if (this.data.length < L.length * INST_FLOATS) this.data = new Float32Array(L.length * INST_FLOATS * 2);
      L.forEach(([x, y, z, w, h, col, yaw], i) => {
        const sc = [w, h, w];
        b.model = compose(mat4(), [x, y + h / 2, z], [0, yaw, 0], sc); b.scale = sc; b.color = col; b.shape = shape === 'trunk' ? 'cylY' : shape; b.tex = shape === 'trunk' ? 62 : 61;
        r.instanceData(this.data, i, b);
      });
      const mesh = shape === 'trunk' ? r.meshesLo.cylY : r.meshes[shape];
      const batch = r.makeBatch(mesh);
      r.fillBatch(batch, this.data, L.length, L.length);
      if (shape === 'trunk') c.trunks = batch; else c.batches.push(batch);
    }
    let lo = Infinity, hi = -Infinity;
    for (const t of c.list) { lo = Math.min(lo, t.y); hi = Math.max(hi, t.y + t.h); }
    if (c.list.length) { c.center[1] = (lo + hi) / 2; c.radius = Math.hypot(CH / 2, CH / 2, (hi - lo) / 2); }
  }
  free(r, c) { if (c.batches) for (const b of c.batches) r.freeBatch(b); if (c.trunks) r.freeBatch(c.trunks); c.batches = null; c.trunks = null; }

  // every frame: make the batches near the eye (a few a frame), free the ones far away
  stream(r, eye, budget = 4) {
    const R = this.draw + CH;
    const ci0 = Math.max(0, Math.floor((eye[0] - R + HALF) / CH)), ci1 = Math.min(HALF * 2 / CH - 1, Math.floor((eye[0] + R + HALF) / CH));
    const ck0 = Math.max(0, Math.floor((eye[2] - R + HALF) / CH)), ck1 = Math.min(HALF * 2 / CH - 1, Math.floor((eye[2] + R + HALF) / CH));
    this.visible.length = 0;
    const todo = [];
    for (let ck = ck0; ck <= ck1; ck++) for (let ci = ci0; ci <= ci1; ci++) {
      const cx = -HALF + ci * CH + CH / 2, cz = -HALF + ck * CH + CH / 2, d = Math.hypot(cx - eye[0], cz - eye[2]);
      if (d > R) continue;
      const c = this.chunks.get(this.key(ci, ck));
      if (c && c.batches) { if (c.list.length) this.visible.push(c); } else todo.push([d, ci, ck]);
    }
    todo.sort((a, b) => a[0] - b[0]);
    for (let n = 0; n < Math.min(budget, todo.length); n++) { const c = this.plan(todo[n][1], todo[n][2]); this.build(r, c); if (c.list.length) this.visible.push(c); }
    for (const c of this.chunks.values()) if (c.batches && Math.hypot(c.center[0] - eye[0], c.center[2] - eye[2]) > R + 400) this.free(r, c);
    return todo.length;
  }
  dispose(r) { for (const c of this.chunks.values()) this.free(r, c); this.chunks.clear(); }

  // collisions: is anything in this box hitting a tree? (trunk, and the lower part of the crown)
  overlap(min, max) {
    const ci0 = Math.floor((min[0] - 8 + HALF) / CH), ci1 = Math.floor((max[0] + 8 + HALF) / CH);
    const ck0 = Math.floor((min[2] - 8 + HALF) / CH), ck1 = Math.floor((max[2] + 8 + HALF) / CH);
    for (let ck = ck0; ck <= ck1; ck++) for (let ci = ci0; ci <= ci1; ci++) {
      if (ci < 0 || ck < 0 || ci >= HALF * 2 / CH || ck >= HALF * 2 / CH) continue;
      for (const t of this.plan(ci, ck).list) {
        if (max[1] < t.y || min[1] > t.y + t.h * 0.92) continue;
        const rr = t.dead ? 0.4 : t.r * (t.pine ? 0.75 * (1 - (min[1] - t.y) / t.h) + 0.2 : 0.8);
        if (t.x + rr < min[0] || t.x - rr > max[0] || t.z + rr < min[2] || t.z - rr > max[2]) continue;
        const B = this.box;
        B.min = [t.x - rr, t.y, t.z - rr]; B.max = [t.x + rr, t.y + t.h * 0.92, t.z + rr];
        return B;
      }
    }
    return null;
  }
}
