// DEAD AIR: smooth helicopter bodies. Each fuselage is "lofted": a list of cross-sections (superellipses: round at
// 2, squarer as the number goes up) along the length, smoothed with a spline into a skin. The windows are patches cut
// from the same skin (a few cm proud of it) with gaps between the panes, so the body colour shows through as frames.
// Meshes are made once and handed to the renderer by name (shape: 'h_warhorse' etc.), in metres, so draw them at scale 1.

// one cross-section: [z, centre y, width, height, roundness top, roundness bottom]
const SEC = {
  warhorse: [
    [-4.08, -0.5, 0.06, 0.06, 2, 2], [-3.98, -0.48, 0.66, 0.58, 2.2, 2.2], [-3.78, -0.42, 1.18, 1.08, 2.4, 2.6], [-3.42, -0.33, 1.64, 1.6, 2.6, 3.0],
    [-2.9, -0.2, 2.0, 1.98, 2.8, 3.6], [-2.2, -0.1, 2.22, 2.22, 3.2, 4.2], [-1.4, -0.05, 2.3, 2.32, 3.6, 4.6], [1.5, -0.02, 2.3, 2.32, 3.6, 4.6],
    [2.25, 0.12, 2.04, 1.96, 3.2, 3.6], [2.95, 0.35, 1.34, 1.22, 2.6, 2.6], [3.7, 0.48, 0.86, 0.82, 2.2, 2.2], [5.5, 0.52, 0.62, 0.62, 2.1, 2.1],
    [7.6, 0.58, 0.44, 0.48, 2.1, 2.1], [8.12, 0.62, 0.34, 0.4, 2, 2], [8.3, 0.62, 0.05, 0.05, 2, 2],
  ],
  warhorse_cowl: [
    [-1.08, 1.06, 0.2, 0.08, 2, 2], [-0.85, 1.1, 1.2, 0.46, 2.5, 4], [-0.3, 1.18, 1.56, 0.76, 3, 5], [1.6, 1.2, 1.6, 0.82, 3.2, 5],
    [2.45, 1.14, 1.2, 0.56, 2.6, 5], [2.78, 1.05, 0.4, 0.16, 2, 2],
  ],
  hornet: [
    [-2.02, -0.36, 0.06, 0.06, 2, 2], [-1.92, -0.34, 0.86, 0.96, 2.1, 2.1], [-1.6, -0.3, 1.36, 1.52, 2.2, 2.4], [-1.0, -0.3, 1.6, 1.8, 2.3, 2.8],
    [-0.2, -0.25, 1.62, 1.86, 2.4, 3.0], [0.5, -0.1, 1.3, 1.5, 2.3, 2.6], [1.0, 0.12, 0.7, 0.8, 2.1, 2.1], [1.4, 0.24, 0.34, 0.36, 2, 2],
    [4.5, 0.27, 0.24, 0.26, 2, 2], [4.72, 0.28, 0.05, 0.05, 2, 2],
  ],
  hornet_cowl: [[-0.88, 0.5, 0.2, 0.08, 2, 2], [-0.62, 0.55, 0.86, 0.5, 2.5, 4], [0.45, 0.56, 0.92, 0.56, 2.8, 4], [0.85, 0.55, 0.5, 0.36, 2.2, 3], [0.98, 0.55, 0.1, 0.08, 2, 2]],
  reaper: [
    [-5.28, -0.42, 0.06, 0.06, 2, 2], [-5.12, -0.38, 0.62, 0.62, 2.2, 2.2], [-4.6, -0.3, 0.96, 1.02, 2.4, 2.6], [-3.8, -0.24, 1.1, 1.36, 2.6, 3.0],
    [-2.0, -0.2, 1.2, 1.46, 3.0, 3.6], [0.0, -0.15, 1.2, 1.46, 3.0, 3.6], [1.4, 0.0, 1.0, 1.16, 2.6, 2.8], [2.4, 0.18, 0.62, 0.7, 2.3, 2.3],
    [6.3, 0.25, 0.42, 0.5, 2.2, 2.2], [6.9, 0.3, 0.3, 0.42, 2, 2], [7.05, 0.3, 0.05, 0.05, 2, 2],
  ],
  reaper_c1: [[-4.3, 0.12, 0.1, 0.08, 2, 2], [-4.05, 0.2, 0.8, 0.56, 2.4, 3], [-3.4, 0.24, 0.94, 0.7, 2.6, 3], [-2.85, 0.26, 0.9, 0.66, 2.6, 3], [-2.7, 0.22, 0.5, 0.3, 2, 2]],
  reaper_c2: [[-3.0, 0.4, 0.1, 0.08, 2, 2], [-2.8, 0.5, 0.86, 0.66, 2.4, 3], [-2.1, 0.58, 0.98, 0.84, 2.6, 3], [-1.5, 0.56, 0.94, 0.78, 2.6, 3], [-1.3, 0.5, 0.5, 0.36, 2, 2]],
  reaper_spine: [[-1.65, 0.62, 0.2, 0.1, 2, 2], [-1.4, 0.78, 0.86, 0.66, 2.6, 4], [0.2, 0.86, 0.96, 0.8, 3, 4], [1.6, 0.6, 0.6, 0.5, 2.6, 3], [2.1, 0.45, 0.2, 0.14, 2, 2]],
  pod: [[-1.12, 0, 0.12, 0.12, 2, 2], [-1.0, 0, 0.62, 0.62, 2, 2], [-0.6, 0, 0.7, 0.7, 2, 2], [0.9, 0, 0.68, 0.68, 2, 2], [1.4, 0, 0.5, 0.5, 2, 2], [1.5, 0, 0.36, 0.36, 2, 2]],
  mule: [
    [-7.62, -0.32, 0.1, 0.1, 2, 2], [-7.52, -0.3, 1.6, 1.5, 2.4, 3], [-7.2, -0.2, 2.42, 2.24, 2.8, 3.6], [-6.6, -0.1, 2.86, 2.62, 3.6, 4.6],
    [-5.8, 0.0, 3.0, 2.8, 4.6, 5.6], [5.5, 0.0, 3.0, 2.8, 4.6, 5.6], [6.2, 0.12, 2.92, 2.6, 4.4, 6], [6.5, 0.18, 2.6, 2.3, 4, 6], [6.58, 0.18, 0.4, 0.4, 2, 2],
  ],
  mule_fwd: [[-6.4, 1.45, 0.3, 0.2, 2, 2], [-6.05, 1.62, 1.3, 0.86, 2.6, 5], [-4.4, 1.7, 1.42, 0.98, 3, 5], [-3.9, 1.6, 0.4, 0.3, 2, 2]],
  mule_aft: [[2.85, 1.9, 0.3, 0.3, 2, 2], [3.25, 2.0, 1.4, 1.7, 2.6, 4], [5.5, 2.1, 1.54, 2.06, 3, 5], [6.35, 2.25, 1.22, 1.62, 2.6, 4], [6.6, 2.3, 0.2, 0.2, 2, 2]],
};

// the windows: [section list, from angle, to angle (degrees, 0 = right, 90 = top), from z, to z]. Each one is
// mirrored to the left unless it already straddles the middle.
const PANES = {
  warhorse: [
    [50, 88, -3.86, -2.58], [60, 87, -2.48, -1.92],                 // windscreen, roof window
    [8, 46, -3.32, -1.78], [226, 252, -3.86, -3.2],                  // side window, chin window
    [14, 38, -1.15, -0.3], [14, 38, 0.2, 1.2],                       // cabin window, door window
  ],
  hornet: [[26, 88, -1.98, -0.78], [218, 254, -1.94, -1.32], [6, 40, -0.62, 0.12]],
  reaper: [],
  mule: [[42, 88, -7.5, -6.62], [228, 256, -7.56, -7.02], [12, 40, -7.12, -6.3]],
};

// Catmull-Rom over the section list: a smooth run of sections, n per span
function smoothSections(S, n) {
  const out = [];
  const at = (i) => S[Math.max(0, Math.min(S.length - 1, i))];
  for (let i = 0; i < S.length - 1; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push(p1.map((_, j) => {
        const v = 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3);
        return j === 2 || j === 3 ? Math.max(0.01, v) : v;
      }));
    }
  }
  out.push(S[S.length - 1]);
  // keep z going forwards
  for (let i = 1; i < out.length; i++) if (out[i][0] <= out[i - 1][0]) out[i][0] = out[i - 1][0] + 0.001;
  return out;
}
const sgnPow = (v, p) => Math.sign(v) * Math.pow(Math.abs(v), p);
function ringPoint(s, th) {
  const c = Math.cos(th), sn = Math.sin(th), nt = sn >= 0 ? s[4] : s[5];
  return [s[2] / 2 * sgnPow(c, 2 / nt), s[1] + s[3] / 2 * sgnPow(sn, 2 / nt), s[0]];
}

// the full skin: rings of M points; normals from the surface itself
function skin(S, M = 48, perSpan = 6) {
  const R = smoothSections(S, perSpan), P = [];
  for (const s of R) for (let j = 0; j <= M; j++) P.push(ringPoint(s, (j / M) * Math.PI * 2));
  const W = M + 1, N = R.length, nrm = new Array(P.length);
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  for (let i = 0; i < N; i++) for (let j = 0; j <= M; j++) {
    const jm = (j - 1 + M) % M, jp = (j + 1) % M;
    const a = P[i * W + jp], b = P[i * W + jm], c = P[Math.min(N - 1, i + 1) * W + j], d = P[Math.max(0, i - 1) * W + j];
    const u = sub(a, b), v = sub(c, d);
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    // make it point away from the centre line
    const p = P[i * W + j], o = [p[0], p[1] - R[i][1], 0];
    if (i === 0) n = [0, 0, -1]; else if (i === N - 1) n = [0, 0, 1];
    else if (n[0] * o[0] + n[1] * o[1] < 0) n = n.map((x) => -x);
    const l = Math.hypot(...n) || 1;
    nrm[i * W + j] = n.map((x) => x / l);
  }
  return { P, nrm, R, W, N, M };
}
function build(P, nrm, quads, off = 0) {
  const v = new Float32Array(P.length * 6);
  P.forEach((p, i) => { const n = nrm[i]; v.set([p[0] + n[0] * off, p[1] + n[1] * off, p[2] + n[2] * off, n[0], n[1], n[2]], i * 6); });
  const idx = [];
  for (const [a, b, c, d] of quads) idx.push(a, b, c, a, c, d);
  // wind every triangle so its face points the same way as its normals (the renderer culls back faces)
  for (let t = 0; t < idx.length; t += 3) {
    const A = P[idx[t]], B = P[idx[t + 1]], C = P[idx[t + 2]];
    const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], w = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const g = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const n = nrm[idx[t]], m = nrm[idx[t + 1]], q = nrm[idx[t + 2]];
    if (g[0] * (n[0] + m[0] + q[0]) + g[1] * (n[1] + m[1] + q[1]) + g[2] * (n[2] + m[2] + q[2]) < 0) { const x = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = x; }
  }
  return { verts: v, indices: new Uint16Array(idx) };
}
export function loft(S, M = 48, perSpan = 6) {
  const K = skin(S, M, perSpan), q = [];
  for (let i = 0; i < K.N - 1; i++) for (let j = 0; j < M; j++) q.push([i * K.W + j, i * K.W + j + 1, (i + 1) * K.W + j + 1, (i + 1) * K.W + j]);
  return build(K.P, K.nrm, q);
}
// window panes: patches of the skin between two angles and two z's, lifted 2 cm off it
export function panes(S, list, M = 96, perSpan = 10) {
  const K = skin(S, M, perSpan), P = [], nrm = [], q = [];
  const all = [];
  for (const [a0, a1, z0, z1] of list) {
    all.push([a0, a1, z0, z1]);
    if (!(a0 < 90 && a1 > 90) && !(a0 < 270 && a1 > 270)) all.push([180 - a1, 180 - a0, z0, z1].map((v, i) => (i < 2 ? (v + 360) % 360 : v)));
  }
  for (const [a0, a1, z0, z1] of all) {
    const rings = [];
    for (let i = 0; i < K.N; i++) if (K.R[i][0] >= z0 && K.R[i][0] <= z1) rings.push(i);
    if (rings.length < 2) continue;
    const j0 = Math.round(a0 / 360 * M), j1 = Math.round(a1 / 360 * M);
    const base = P.length, cols = j1 - j0 + 1;
    for (const i of rings) for (let j = j0; j <= j1; j++) { const k = i * K.W + (j % M); P.push(K.P[k]); nrm.push(K.nrm[k]); }
    for (let r = 0; r < rings.length - 1; r++) for (let c = 0; c < cols - 1; c++) {
      const a = base + r * cols + c;
      q.push([a, a + 1, a + cols + 1, a + cols]);
    }
  }
  return build(P, nrm, q, 0.025);
}

// every hull mesh by name, for the renderer
export function hullGeometries() {
  const G = {};
  for (const k of Object.keys(SEC)) G['h_' + k] = loft(SEC[k], k === 'pod' ? 24 : 48);
  for (const k of Object.keys(PANES)) if (PANES[k].length) G['g_' + k] = panes(SEC[k], PANES[k]);
  // the Reaper's canopies are glass all over
  G.g_reaper_c1 = loft(SEC.reaper_c1, 40); G.g_reaper_c2 = loft(SEC.reaper_c2, 40);
  return G;
}
