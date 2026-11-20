// DEAD AIR: the land. A procedural heightmap made from a seed (every new world is different, and friends who join get the
// same seed and the same world): 6.4 km across, with rolling farmland, forests, river valleys winding through it, lakes,
// and whole mountain ranges, plus flat patches cut in for the cities, towns and villages with roads between them.
//
// It's only worked out where it's needed: the land is made 64 m tile by tile the first time anything asks about it, and
// the meshes you see are built in 128 m chunks around the camera, finer close up and coarser far away, as you fly.
// GeoWorld is the box World (buildings) plus this ground plus the trees, so everything that asks "what's here?" (the
// helicopter, bullets, debris, the camera) gets the hills and the forests too.
import { World } from '../world.js';

export const HALF = 3200, CELL = 4, N = HALF * 2 / CELL + 1, WATER = 0;
export const CH = 128;                       // mesh chunk size (32 cells)
const TILE = 16, NT = Math.ceil(N / TILE);   // generation tiles (64 m)

export function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
export const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// seeded value noise
export function makeNoise(seed) {
  const P = new Uint8Array(512), R = rng(seed);
  for (let i = 0; i < 256; i++) P[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = P[i]; P[i] = P[j]; P[j] = t; }
  for (let i = 0; i < 256; i++) P[i + 256] = P[i];
  const V = new Float32Array(256).map(() => R());
  const h = (x, z) => V[P[(P[x & 255] + z) & 255]];
  const n2 = (x, z) => {
    const xi = Math.floor(x), zi = Math.floor(z), tx = x - xi, tz = z - zi, fx = tx * tx * (3 - 2 * tx), fz = tz * tz * (3 - 2 * tz);
    const a = h(xi, zi), b = h(xi + 1, zi), c = h(xi, zi + 1), d = h(xi + 1, zi + 1);
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
  };
  const fbm = (x, z, oct = 5) => { let s = 0, amp = 0.5, f = 1, tot = 0; for (let o = 0; o < oct; o++) { s += n2(x * f + o * 17.3, z * f - o * 9.1) * amp; tot += amp; amp *= 0.5; f *= 2.03; } return s / tot; };
  fbm.n2 = n2;
  return fbm;
}

export class Terrain {
  constructor(seed) {
    this.seed = seed;
    this.noise = makeNoise(seed);
    this.h = new Float32Array(N * N);
    this.made = new Uint8Array(NT * NT);
    this.ops = [];                 // flat patches and roads, applied in order to every tile as it's made
    this.meshes = new Map();       // chunk key -> { mesh, lod, center, radius, model }
    this.chunks = [];              // the ones to draw this frame
    this.model = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  }

  // ---- the shape of the land (no towns or roads): used for tiles, the map picture and planning where things go
  natural(x, z) {
    const nz = this.noise;
    // warp the coordinates a little so nothing looks like it came off a grid
    const wx = x + (nz(x / 700, z / 700, 3) - 0.5) * 360, wz = z + (nz(x / 700 + 31, z / 700 + 77, 3) - 0.5) * 360;
    const cont = (nz(wx / 2200, wz / 2200, 4) - 0.5) * 2;                    // the big lie of the land: high and low country
    const hills = (nz(wx / 520, wz / 520, 5) - 0.5) * 2;
    const detail = (nz(wx / 110 + 40, wz / 110 + 40, 3) - 0.5) * 2;
    // mountain ranges: ridged noise, only where the range mask says so (and always round the edge of the world)
    const edge = smooth(HALF - 700, HALF - 120, Math.max(Math.abs(x), Math.abs(z)));
    const rangeMask = Math.max(smooth(0.53, 0.68, nz(wx / 1700 + 50, wz / 1700 + 50, 3)), edge);
    let ridge = 0;
    if (rangeMask > 0) {
      const r1 = 1 - Math.abs(nz(wx / 420 + 9, wz / 420 + 9, 5) * 2 - 1), r2 = 1 - Math.abs(nz(wx / 160 + 3, wz / 160 + 3, 3) * 2 - 1);
      ridge = rangeMask * (r1 * r1 * 230 + r2 * r2 * 45 + 30);
    }
    let h = 22 + cont * 26 + hills * 20 * (0.6 + 0.4 * (cont + 1) / 2) + detail * 3.5 + ridge;
    // rivers: valleys where a warped noise crosses the middle, cut down below the water
    const rv = Math.abs(nz(wx / 1800 + 300, wz / 1800 - 120, 4) - 0.5);
    const bank = smooth(0.012, 0.06, rv), bed = smooth(0.0, 0.014, rv);
    if (bank < 1) h = h * bank + (WATER - 3.5 + bed * 5) * (1 - bank) * (1 - rangeMask * 0.85) + h * (1 - bank) * rangeMask * 0.85;
    return h;
  }
  // how wooded a place is (0..1): forests on the hills and in damp hollows, open fields between
  forest(x, z) {
    const nz = this.noise;
    return smooth(0.5, 0.66, nz(x / 640 + 210, z / 640 - 90, 4) + (nz(x / 90, z / 90, 2) - 0.5) * 0.18);
  }

  // make a 64 m tile: the natural land, then every flat patch / road that touches it, in order
  tile(ti, tk) {
    const T = tk * NT + ti;
    if (this.made[T]) return;
    this.made[T] = 1;
    const i0 = ti * TILE, k0 = tk * TILE, i1 = Math.min(N - 1, i0 + TILE - 1), k1 = Math.min(N - 1, k0 + TILE - 1);
    for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) this.h[k * N + i] = this.natural(-HALF + i * CELL, -HALF + k * CELL);
    const x0 = -HALF + i0 * CELL, x1 = -HALF + i1 * CELL, z0 = -HALF + k0 * CELL, z1 = -HALF + k1 * CELL;
    for (const op of this.ops) if (op.x1 >= x0 && op.x0 <= x1 && op.z1 >= z0 && op.z0 <= z1) this.applyOp(op, i0, i1, k0, k1);
  }
  ensure(i0, i1, k0, k1) {
    const a = Math.max(0, Math.floor(i0 / TILE)), b = Math.min(NT - 1, Math.floor(i1 / TILE)), c = Math.max(0, Math.floor(k0 / TILE)), d = Math.min(NT - 1, Math.floor(k1 / TILE));
    for (let tk = c; tk <= d; tk++) for (let ti = a; ti <= b; ti++) if (!this.made[tk * NT + ti]) this.tile(ti, tk);
  }
  raw(i, k) {
    const T = Math.floor(k / TILE) * NT + Math.floor(i / TILE);
    if (!this.made[T]) this.tile(Math.floor(i / TILE), Math.floor(k / TILE));
    return this.h[k * N + i];
  }

  heightAt(x, z) {
    if (x < -HALF - 8 || x > HALF + 8 || z < -HALF - 8 || z > HALF + 8) return -1000;      // off the map (the hangar lives out there)
    const fx = (x + HALF) / CELL, fz = (z + HALF) / CELL;
    const i = Math.max(0, Math.min(N - 2, Math.floor(fx))), k = Math.max(0, Math.min(N - 2, Math.floor(fz)));
    const tx = Math.max(0, Math.min(1, fx - i)), tz = Math.max(0, Math.min(1, fz - k));
    const a = this.raw(i, k), b = this.raw(i + 1, k), c = this.raw(i, k + 1), d = this.raw(i + 1, k + 1);
    // the cell is split into two triangles the same way the mesh is
    return tx + tz <= 1 ? a + (b - a) * tx + (c - a) * tz : d + (c - d) * (1 - tx) + (b - d) * (1 - tz);
  }
  normalAt(x, z, e = 2) {
    const dx = this.heightAt(x + e, z) - this.heightAt(x - e, z), dz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    const l = Math.hypot(dx, 2 * e, dz);
    return [-dx / l, (2 * e) / l, -dz / l];
  }
  slopeAt(x, z) { return 1 - this.normalAt(x, z)[1]; }

  // ---- changes: recorded, applied to tiles already made, and to every tile made later
  addOp(op) {
    const i0 = Math.max(0, Math.floor((op.x0 + HALF) / CELL)), i1 = Math.min(N - 1, Math.ceil((op.x1 + HALF) / CELL));
    const k0 = Math.max(0, Math.floor((op.z0 + HALF) / CELL)), k1 = Math.min(N - 1, Math.ceil((op.z1 + HALF) / CELL));
    // only the tiles that already exist need it now (new ones pick it up when they're made)
    for (let tk = Math.floor(k0 / TILE); tk <= Math.floor(k1 / TILE); tk++) for (let ti = Math.floor(i0 / TILE); ti <= Math.floor(i1 / TILE); ti++) {
      if (!this.made[tk * NT + ti]) continue;
      this.applyOp(op, Math.max(i0, ti * TILE), Math.min(i1, ti * TILE + TILE - 1), Math.max(k0, tk * TILE), Math.min(k1, tk * TILE + TILE - 1));
    }
    this.ops.push(op);
    this.dirtyMeshes(op);
  }
  applyOp(op, i0, i1, k0, k1) {
    const H = this.h;
    for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) {
      const px = -HALF + i * CELL, pz = -HALF + k * CELL;
      if (px < op.x0 || px > op.x1 || pz < op.z0 || pz > op.z1) continue;
      let w, target;
      if (op.k === 'rect') {
        // a rectangle (rx, rz = half sizes), sharp or blended at the edges
        const d = Math.max(0, Math.abs(px - op.x) - op.rx, Math.abs(pz - op.z) - op.rz);
        w = d <= 0 ? 1 : d >= op.blend ? 0 : 1 - d / op.blend;
        target = op.h;
      } else if (op.k === 'flat') {
        // a rounded square: flat right up to the corners of the town grid
        const d = Math.max(Math.abs(px - op.x), Math.abs(pz - op.z)) * 0.8 + Math.hypot(px - op.x, pz - op.z) * 0.2;
        w = d <= op.r ? 1 : d >= op.r + op.blend ? 0 : 1 - (d - op.r) / op.blend;
        target = op.h;
      } else if (op.k === 'disc') {
        // a round patch (lakes, bays)
        const d = Math.hypot(px - op.x, pz - op.z);
        w = d <= op.r ? 1 : d >= op.r + op.blend ? 0 : 1 - (d - op.r) / op.blend;
        target = op.h;
        if (target > H[k * N + i]) continue;                              // only ever digs
      } else if (op.k === 'chan') {
        // a river channel: a segment whose width goes from ra to rb, dug down to h (deepest in the middle)
        const dx = op.bx - op.ax, dz = op.bz - op.az, L2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((px - op.ax) * dx + (pz - op.az) * dz) / L2));
        const d = Math.hypot(px - op.ax - dx * t, pz - op.az - dz * t), half = op.ra + (op.rb - op.ra) * t;
        if (d > half + op.blend) continue;
        w = d <= half ? 1 : 1 - (d - half) / op.blend;
        target = op.h + (op.shelf - op.h) * Math.min(1, Math.max(0, (d - half * 0.55) / (half * 0.45 + 1)));
        if (target > H[k * N + i]) continue;                              // only ever digs
      } else {
        const dx = op.bx - op.ax, dz = op.bz - op.az, L2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((px - op.ax) * dx + (pz - op.az) * dz) / L2));
        const d = Math.hypot(px - op.ax - dx * t, pz - op.az - dz * t);
        if (d > op.half + op.blend) continue;
        w = d <= op.half ? 1 : 1 - (d - op.half) / op.blend;
        target = Math.max(WATER + 1.4, op.ah + (op.bh - op.ah) * t);
        if (op.bridge && target > H[k * N + i] + 0.5 && d > op.half) continue;     // a causeway over low ground: don't drag the banks up
      }
      if (w <= 0) continue;
      const s = w * w * (3 - 2 * w);
      H[k * N + i] += (target - H[k * N + i]) * s;
    }
  }
  rect(x, z, rx, rz, h, blend = 30) { const m = blend + 4; this.addOp({ k: 'rect', x, z, rx, rz, h, blend, x0: x - rx - m, x1: x + rx + m, z0: z - rz - m, z1: z + rz + m }); }
  flatten(x, z, r, h, blend = 40) { const m = r + blend + 4; this.addOp({ k: 'flat', x, z, r, h, blend, x0: x - m, x1: x + m, z0: z - m, z1: z + m }); }
  disc(x, z, r, h, blend = 40) { const m = r + blend + 4; this.addOp({ k: 'disc', x, z, r, h, blend, x0: x - m, x1: x + m, z0: z - m, z1: z + m }); }
  channel(ax, az, bx, bz, ra, rb, h, shelf, blend = 30) {
    const m = Math.max(ra, rb) + blend + 4;
    this.addOp({ k: 'chan', ax, az, bx, bz, ra, rb, h, shelf, blend, x0: Math.min(ax, bx) - m, x1: Math.max(ax, bx) + m, z0: Math.min(az, bz) - m, z1: Math.max(az, bz) + m });
  }
  road(ax, az, ah, bx, bz, bh, half = 6, blend = 16) {
    const m = half + blend + 4;
    this.addOp({ k: 'road', ax, az, ah, bx, bz, bh, half, blend, x0: Math.min(ax, bx) - m, x1: Math.max(ax, bx) + m, z0: Math.min(az, bz) - m, z1: Math.max(az, bz) + m });
  }

  // ray against the ground: march, then refine. Returns { t, point, normal } or null
  raycast(o, d, maxT) {
    let t = 0;
    const prev = o[1] - this.heightAt(o[0], o[2]);
    if (prev < 0 && Math.abs(o[0]) < HALF && Math.abs(o[2]) < HALF) return { t: 0, point: [...o], normal: this.normalAt(o[0], o[2]) };
    const step = Math.max(1, Math.min(4, maxT / 40));
    while (t < maxT) {
      const nt = Math.min(maxT, t + step), x = o[0] + d[0] * nt, y = o[1] + d[1] * nt, z = o[2] + d[2] * nt;
      if (Math.abs(x) > HALF || Math.abs(z) > HALF) return null;
      const gap = y - this.heightAt(x, z);
      if (gap < 0) {
        let lo = t, hi = nt;
        for (let it = 0; it < 8; it++) { const m = (lo + hi) / 2; const g = o[1] + d[1] * m - this.heightAt(o[0] + d[0] * m, o[2] + d[2] * m); if (g < 0) hi = m; else lo = m; }
        const p = [o[0] + d[0] * hi, o[1] + d[1] * hi, o[2] + d[2] * hi];
        return { t: hi, point: p, normal: this.normalAt(p[0], p[2]) };
      }
      t = nt + (gap > 30 ? Math.min(gap * 0.5, 60) : 0);
    }
    return null;
  }

  // ---- meshes, streamed round the camera. LOD 1 = every 4 m, 2 = 8 m, 4 = 16 m, 8 = 32 m. Each chunk has a skirt
  // hanging down round its edge so the cracks between a fine chunk and a coarse one never show.
  lodFor(d) { return d < 420 ? 1 : d < 1000 ? 2 : d < 2000 ? 4 : 8; }
  buildChunk(r, cx, cz, lod) {
    const per = CH / CELL / lod, st = CELL * lod, V = per + 1;
    const ring = 4 * per;
    const verts = new Float32Array((V * V + ring * 2) * 6), idx = [];
    let v = 0, lo = Infinity, hi = -Infinity;
    const put = (x, y, z, n) => { verts[v++] = x; verts[v++] = y; verts[v++] = z; verts[v++] = n[0]; verts[v++] = n[1]; verts[v++] = n[2]; };
    const H = (i, k) => this.raw(Math.min(N - 1, i), Math.min(N - 1, k));
    const gi0 = (cx + HALF) / CELL, gk0 = (cz + HALF) / CELL;
    this.ensure(gi0 - lod, gi0 + per * lod + lod, gk0 - lod, gk0 + per * lod + lod);
    for (let k = 0; k <= per; k++) for (let i = 0; i <= per; i++) {
      const gi = gi0 + i * lod, gk = gk0 + k * lod, y = H(gi, gk);
      const dx = H(Math.min(N - 1, gi + lod), gk) - H(Math.max(0, gi - lod), gk), dz = H(gi, Math.min(N - 1, gk + lod)) - H(gi, Math.max(0, gk - lod));
      const l = Math.hypot(dx, 2 * st, dz);
      put(cx + i * st, y, cz + k * st, [-dx / l, (2 * st) / l, -dz / l]);
      lo = Math.min(lo, y); hi = Math.max(hi, y);
    }
    for (let k = 0; k < per; k++) for (let i = 0; i < per; i++) { const a = k * V + i, b = a + 1, c = a + V, d = c + 1; idx.push(a, c, b, b, c, d); }
    // the skirt: walk the edge, drop a copy of each vertex
    const edge = [];
    for (let i = 0; i < per; i++) edge.push(i);
    for (let k = 0; k < per; k++) edge.push(k * V + per);
    for (let i = per; i > 0; i--) edge.push(per * V + i);
    for (let k = per; k > 0; k--) edge.push(k * V);
    const drop = 4 + lod * 3, s0 = v / 6;
    for (const e of edge) put(verts[e * 6], verts[e * 6 + 1] - drop, verts[e * 6 + 2], [verts[e * 6 + 3], verts[e * 6 + 4], verts[e * 6 + 5]]);
    for (let j = 0; j < edge.length; j++) { const a = edge[j], b = edge[(j + 1) % edge.length], c = s0 + j, d = s0 + (j + 1) % edge.length; idx.push(a, b, c, b, d, c); }
    const mesh = r.makeMesh({ verts: verts.subarray(0, v), indices: new Uint16Array(idx) });
    return { mesh, lod, center: [cx + CH / 2, (lo + hi) / 2, cz + CH / 2], radius: Math.hypot(CH / 2, CH / 2, (hi - lo) / 2 + 4), model: this.model, hi, lo, cx, cz };
  }
  freeChunk(r, c) { const gl = r.gl; gl.deleteBuffer(c.mesh.vb); gl.deleteBuffer(c.mesh.ib); gl.deleteVertexArray(c.mesh.vao); r.boundMesh = null; }
  dirtyMeshes(op) { for (const c of this.meshes.values()) if (c.cx + CH >= op.x0 && c.cx <= op.x1 && c.cz + CH >= op.z0 && c.cz <= op.z1) c.stale = true; }
  // call every frame: builds what's missing near the eye (a few per frame), drops what's far away
  stream(r, eye, range = 3000, budget = 6) {
    const want = [];
    const ci0 = Math.max(0, Math.floor((eye[0] - range + HALF) / CH)), ci1 = Math.min(HALF * 2 / CH - 1, Math.floor((eye[0] + range + HALF) / CH));
    const ck0 = Math.max(0, Math.floor((eye[2] - range + HALF) / CH)), ck1 = Math.min(HALF * 2 / CH - 1, Math.floor((eye[2] + range + HALF) / CH));
    const seen = new Set();
    this.chunks.length = 0;
    for (let ck = ck0; ck <= ck1; ck++) for (let ci = ci0; ci <= ci1; ci++) {
      const cx = -HALF + ci * CH, cz = -HALF + ck * CH;
      const d = Math.max(0, Math.hypot(cx + CH / 2 - eye[0], cz + CH / 2 - eye[2]) - CH * 0.7);
      if (d > range) continue;
      const key = ck * 1000 + ci, lod = this.lodFor(d);
      seen.add(key);
      const c = this.meshes.get(key);
      if (!c || c.lod !== lod || c.stale) want.push([d, key, cx, cz, lod]);
      if (c) this.chunks.push(c);
    }
    want.sort((a, b) => a[0] - b[0]);
    for (let n = 0; n < Math.min(budget, want.length); n++) {
      const [, key, cx, cz, lod] = want[n], old = this.meshes.get(key);
      const c = this.buildChunk(r, cx, cz, lod);
      if (old) { this.freeChunk(r, old); this.chunks[this.chunks.indexOf(old)] = c; } else this.chunks.push(c);
      this.meshes.set(key, c);
    }
    for (const [key, c] of this.meshes) if (!seen.has(key)) { this.freeChunk(r, c); this.meshes.delete(key); }
    return want.length;
  }
  dispose(r) { for (const c of this.meshes.values()) this.freeChunk(r, c); this.meshes.clear(); this.chunks.length = 0; }
}

// the box world plus the ground plus tree trunks
export class GeoWorld extends World {
  constructor(terrain) {
    super(); this.terrain = terrain;
    this.ground = { color: [0.3, 0.33, 0.2], solid: true, id: -1, terrain: true, min: [0, 0, 0], max: [0, 0, 0] };
    this.trees = null;      // set by the forest (trees.js)
  }
  pointInside(p) { return p[1] < this.terrain.heightAt(p[0], p[2]) || super.pointInside(p); }
  firstOverlap(min, max, ignore) {
    const b = super.firstOverlap(min, max, ignore);
    if (b) return b;
    const T = this.terrain, h = Math.max(T.heightAt(min[0], min[2]), T.heightAt(max[0], min[2]), T.heightAt(min[0], max[2]), T.heightAt(max[0], max[2]), T.heightAt((min[0] + max[0]) / 2, (min[2] + max[2]) / 2));
    if (min[1] < h) return { ...this.ground, min: [min[0] - 0.01, -1e4, min[2] - 0.01], max: [max[0] + 0.01, h, max[2] + 0.01] };
    return this.trees ? this.trees.overlap(min, max) : null;
  }
  raycast(o, d, maxT = 500, bullets = true, skip = null) {
    const b = super.raycast(o, d, maxT, bullets, skip);
    const g = this.terrain.raycast(o, d, b ? b.t : maxT);
    if (g && (!b || g.t < b.t)) return { t: g.t, point: g.point, normal: g.normal, box: this.ground };
    return b;
  }
}
