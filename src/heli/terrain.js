// DEAD AIR: the land. A procedural heightmap made from a seed (so every new game is a new world, and friends who join
// get the same seed and the same world): rolling hills, a ring of mountains at the edge, lakes in the low ground, and
// flat patches cut in for the city and the towns, with roads between them.
// GeoWorld is the box World (buildings) plus this ground, so everything that asks "what's here?" (the helicopter, bullets,
// debris, the camera) gets the hills too.
import { World } from '../world.js';

export const HALF = 1200, CELL = 4, N = HALF * 2 / CELL + 1, WATER = 0;
export const CH = 64;                 // mesh chunk size (16 cells)

export function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// seeded value noise
function makeNoise(seed) {
  const P = new Uint8Array(512), R = rng(seed);
  for (let i = 0; i < 256; i++) P[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = P[i]; P[i] = P[j]; P[j] = t; }
  for (let i = 0; i < 256; i++) P[i + 256] = P[i];
  const V = new Float32Array(256).map(() => R());
  const h = (x, z) => V[P[(P[x & 255] + z) & 511]];
  const sm = (t) => t * t * (3 - 2 * t);
  const n2 = (x, z) => {
    const xi = Math.floor(x), zi = Math.floor(z), fx = sm(x - xi), fz = sm(z - zi);
    const a = h(xi, zi), b = h(xi + 1, zi), c = h(xi, zi + 1), d = h(xi + 1, zi + 1);
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
  };
  return (x, z, oct = 5) => { let s = 0, amp = 0.5, f = 1, tot = 0; for (let o = 0; o < oct; o++) { s += n2(x * f, z * f) * amp; tot += amp; amp *= 0.5; f *= 2.03; } return s / tot; };
}

export class Terrain {
  constructor(seed) {
    this.seed = seed;
    this.noise = makeNoise(seed);
    this.h = new Float32Array(N * N);
    const nz = this.noise;
    for (let k = 0; k < N; k++) for (let i = 0; i < N; i++) {
      const x = -HALF + i * CELL, z = -HALF + k * CELL;
      const hills = (nz(x / 520, z / 520) - 0.5) * 2;                    // -1..1, big rolling shapes
      const detail = (nz(x / 90 + 40, z / 90 + 40, 3) - 0.5) * 2;
      const ridge = 1 - Math.abs(nz(x / 300 + 9, z / 300 + 9, 4) * 2 - 1);
      const edge = Math.max(0, Math.min(1, (Math.max(Math.abs(x), Math.abs(z)) - 780) / 380));
      this.h[k * N + i] = 14 + hills * 34 + detail * 5 + edge * edge * (90 + ridge * 120);
    }
  }
  natural(x, z) { return this.heightAt(x, z); }

  heightAt(x, z) {
    if (x < -HALF - 8 || x > HALF + 8 || z < -HALF - 8 || z > HALF + 8) return -1000;      // off the map (the hangar lives out there)
    const fx = (x + HALF) / CELL, fz = (z + HALF) / CELL;
    const i = Math.max(0, Math.min(N - 2, Math.floor(fx))), k = Math.max(0, Math.min(N - 2, Math.floor(fz)));
    const tx = Math.max(0, Math.min(1, fx - i)), tz = Math.max(0, Math.min(1, fz - k));
    const H = this.h, a = H[k * N + i], b = H[k * N + i + 1], c = H[(k + 1) * N + i], d = H[(k + 1) * N + i + 1];
    // the cell is split into two triangles the same way the mesh is
    return tx + tz <= 1 ? a + (b - a) * tx + (c - a) * tz : d + (c - d) * (1 - tx) + (b - d) * (1 - tz);
  }
  normalAt(x, z) {
    const e = 2, dx = this.heightAt(x + e, z) - this.heightAt(x - e, z), dz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    const l = Math.hypot(dx, 2 * e, dz);
    return [-dx / l, (2 * e) / l, -dz / l];
  }
  slopeAt(x, z) { return 1 - this.normalAt(x, z)[1]; }

  // cut a flat patch: everything inside r is height h, blending back to the hills over `blend` metres
  flatten(x, z, r, h, blend = 40) {
    const i0 = Math.max(0, Math.floor((x - r - blend + HALF) / CELL)), i1 = Math.min(N - 1, Math.ceil((x + r + blend + HALF) / CELL));
    const k0 = Math.max(0, Math.floor((z - r - blend + HALF) / CELL)), k1 = Math.min(N - 1, Math.ceil((z + r + blend + HALF) / CELL));
    for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) {
      const px = -HALF + i * CELL, pz = -HALF + k * CELL;
      // a rounded square: flat right up to the corners of the town grid
      const d = Math.max(Math.abs(px - x), Math.abs(pz - z)) * 0.8 + Math.hypot(px - x, pz - z) * 0.2;
      const w = d <= r ? 1 : d >= r + blend ? 0 : 1 - (d - r) / blend;
      const s = w * w * (3 - 2 * w);
      this.h[k * N + i] += (h - this.h[k * N + i]) * s;
    }
  }
  // a road: a strip at a steady slope from a to b, blended into the ground either side
  road(ax, az, ah, bx, bz, bh, half = 6, blend = 16) {
    const minx = Math.min(ax, bx) - half - blend, maxx = Math.max(ax, bx) + half + blend, minz = Math.min(az, bz) - half - blend, maxz = Math.max(az, bz) + half + blend;
    const i0 = Math.max(0, Math.floor((minx + HALF) / CELL)), i1 = Math.min(N - 1, Math.ceil((maxx + HALF) / CELL));
    const k0 = Math.max(0, Math.floor((minz + HALF) / CELL)), k1 = Math.min(N - 1, Math.ceil((maxz + HALF) / CELL));
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
    for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) {
      const px = -HALF + i * CELL, pz = -HALF + k * CELL;
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L2));
      const d = Math.hypot(px - ax - dx * t, pz - az - dz * t);
      if (d > half + blend) continue;
      const rh = Math.max(WATER + 1.2, ah + (bh - ah) * t);
      const w = d <= half ? 1 : 1 - (d - half) / blend, s = w * w * (3 - 2 * w);
      this.h[k * N + i] += (rh - this.h[k * N + i]) * s;
    }
  }

  // ray against the ground: march, then refine. Returns { t, point, normal } or null
  raycast(o, d, maxT) {
    let t = 0, prev = o[1] - this.heightAt(o[0], o[2]);
    if (prev < 0) return { t: 0, point: [...o], normal: this.normalAt(o[0], o[2]) };
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
      // big gap? take bigger steps
      t = nt + (gap > 30 ? Math.min(gap * 0.5, 40) : 0);
    }
    return null;
  }

  // mesh chunks: { mesh, center, radius, model }
  buildMeshes(r) {
    this.chunks = [];
    const per = CH / CELL, model = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    for (let cz = -HALF; cz < HALF; cz += CH) for (let cx = -HALF; cx < HALF; cx += CH) {
      const verts = new Float32Array((per + 1) * (per + 1) * 6), idx = new Uint16Array(per * per * 6);
      let v = 0, lo = Infinity, hi = -Infinity;
      for (let k = 0; k <= per; k++) for (let i = 0; i <= per; i++) {
        const x = cx + i * CELL, z = cz + k * CELL, y = this.heightAt(x, z), n = this.normalAt(x, z);
        verts.set([x, y, z, n[0], n[1], n[2]], v); v += 6;
        lo = Math.min(lo, y); hi = Math.max(hi, y);
      }
      let q = 0;
      for (let k = 0; k < per; k++) for (let i = 0; i < per; i++) {
        const a = k * (per + 1) + i, b = a + 1, c = a + per + 1, d = c + 1;
        idx.set([a, c, b, b, c, d], q); q += 6;
      }
      const center = [cx + CH / 2, (lo + hi) / 2, cz + CH / 2];
      this.chunks.push({ mesh: r.makeMesh({ verts, indices: idx }), center, radius: Math.hypot(CH / 2, CH / 2, (hi - lo) / 2), model, hi });
    }
  }
}

// the box world plus the ground
export class GeoWorld extends World {
  constructor(terrain) { super(); this.terrain = terrain; this.ground = { color: [0.3, 0.33, 0.2], solid: true, id: -1, terrain: true, min: [0, 0, 0], max: [0, 0, 0] }; }
  pointInside(p) { return p[1] < this.terrain.heightAt(p[0], p[2]) || super.pointInside(p); }
  firstOverlap(min, max, ignore) {
    const b = super.firstOverlap(min, max, ignore);
    if (b) return b;
    const T = this.terrain, h = Math.max(T.heightAt(min[0], min[2]), T.heightAt(max[0], min[2]), T.heightAt(min[0], max[2]), T.heightAt(max[0], max[2]), T.heightAt((min[0] + max[0]) / 2, (min[2] + max[2]) / 2));
    if (min[1] >= h) return null;
    return { ...this.ground, min: [min[0] - 0.01, -1e4, min[2] - 0.01], max: [max[0] + 0.01, h, max[2] + 0.01] };
  }
  raycast(o, d, maxT = 500, bullets = true, skip = null) {
    const b = super.raycast(o, d, maxT, bullets, skip);
    const g = this.terrain.raycast(o, d, b ? b.t : maxT);
    if (g && (!b || g.t < b.t)) return { t: g.t, point: g.point, normal: g.normal, box: this.ground };
    return b;
  }
}
