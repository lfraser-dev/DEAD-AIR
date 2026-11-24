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
  kestrel: [
    [-5.42, -0.5, 0.06, 0.06, 2, 2], [-5.3, -0.48, 0.72, 0.62, 2.2, 2.2], [-5.06, -0.42, 1.32, 1.16, 2.4, 2.8], [-4.65, -0.32, 1.86, 1.72, 2.6, 3.2],
    [-4.0, -0.2, 2.26, 2.16, 3, 4], [-3.2, -0.1, 2.5, 2.46, 3.6, 4.8], [-2.4, -0.05, 2.6, 2.56, 4, 5], [2.4, 0, 2.6, 2.56, 4, 5],
    [3.3, 0.15, 2.34, 2.2, 3.6, 4], [4.2, 0.4, 1.5, 1.4, 2.8, 2.8], [5.0, 0.55, 0.96, 0.96, 2.3, 2.3], [7.6, 0.65, 0.62, 0.66, 2.1, 2.1],
    [9.4, 0.75, 0.46, 0.52, 2, 2], [9.9, 0.8, 0.32, 0.38, 2, 2], [10.06, 0.8, 0.05, 0.05, 2, 2],
  ],
  kestrel_cowl: [[-2.32, 1.2, 0.3, 0.1, 2, 2], [-2.0, 1.25, 1.5, 0.5, 2.5, 4], [-1.3, 1.35, 1.9, 0.86, 3, 5], [1.8, 1.38, 1.96, 0.9, 3.2, 5], [2.8, 1.3, 1.4, 0.6, 2.6, 5], [3.16, 1.2, 0.5, 0.2, 2, 2]],
  viper: [
    [-4.92, -0.35, 0.06, 0.06, 2, 2], [-4.78, -0.33, 0.5, 0.5, 2.2, 2.2], [-4.4, -0.28, 0.8, 0.86, 2.4, 2.6], [-3.6, -0.22, 0.96, 1.2, 2.6, 3],
    [-1.6, -0.2, 1.0, 1.34, 3, 3.4], [0.4, -0.15, 1.0, 1.34, 3, 3.4], [1.6, 0.0, 0.84, 1.04, 2.6, 2.8], [2.6, 0.15, 0.55, 0.62, 2.3, 2.3],
    [6.4, 0.25, 0.36, 0.44, 2.1, 2.1], [6.95, 0.3, 0.26, 0.36, 2, 2], [7.1, 0.3, 0.05, 0.05, 2, 2],
  ],
  viper_c: [[-4.0, 0.15, 0.1, 0.08, 2, 2], [-3.75, 0.25, 0.72, 0.56, 2.4, 3], [-2.6, 0.38, 0.86, 0.76, 2.6, 3], [-1.6, 0.48, 0.88, 0.86, 2.6, 3], [-1.0, 0.45, 0.8, 0.7, 2.6, 3], [-0.74, 0.38, 0.4, 0.3, 2, 2]],
  viper_spine: [[-1.02, 0.55, 0.2, 0.1, 2, 2], [-0.75, 0.68, 0.8, 0.6, 2.6, 4], [0.8, 0.75, 0.86, 0.72, 3, 4], [2.0, 0.55, 0.55, 0.46, 2.6, 3], [2.5, 0.4, 0.2, 0.14, 2, 2]],
  // HUEY: the classic. A big round glassy nose, a tall square cabin with wide doors, a thin boom
  huey: [
    [-4.3, -0.35, 0.06, 0.06, 2, 2], [-4.16, -0.32, 1.0, 1.16, 2.2, 2.2], [-3.85, -0.22, 1.72, 1.9, 2.4, 2.6], [-3.3, -0.12, 2.24, 2.22, 2.8, 3.4],
    [-2.6, -0.06, 2.42, 2.34, 3.4, 4.6], [1.15, -0.04, 2.42, 2.34, 3.4, 4.6], [1.85, 0.16, 1.8, 1.68, 3, 3.4], [2.6, 0.45, 0.9, 0.9, 2.3, 2.3],
    [5.6, 0.55, 0.56, 0.6, 2.1, 2.1], [8.3, 0.66, 0.4, 0.46, 2, 2], [8.46, 0.66, 0.05, 0.05, 2, 2],
  ],
  huey_cowl: [[-1.7, 1.1, 0.2, 0.08, 2, 2], [-1.4, 1.18, 1.3, 0.62, 2.5, 4], [1.3, 1.24, 1.36, 0.74, 3, 5], [2.2, 1.14, 0.95, 0.5, 2.6, 4], [2.5, 1.08, 0.2, 0.1, 2, 2]],
  // SEA KING: a big boat-hulled rescue helicopter: V-shaped bottom so it can sit on the water, float sponsons
  seaking: [
    [-6.12, -0.3, 0.06, 0.06, 2, 2], [-5.95, -0.26, 1.36, 1.36, 2.2, 2.0], [-5.45, -0.12, 2.2, 2.2, 2.5, 1.9], [-4.65, -0.02, 2.62, 2.6, 3, 1.85],
    [-3.6, 0.04, 2.72, 2.72, 3.6, 1.8], [3.1, 0.08, 2.72, 2.72, 3.6, 1.8], [4.5, 0.34, 1.9, 1.9, 3, 2], [5.9, 0.7, 1.0, 1.1, 2.4, 2.4],
    [9.7, 0.92, 0.6, 0.7, 2.1, 2.1], [10.5, 1.0, 0.42, 0.5, 2, 2], [10.66, 1.0, 0.05, 0.05, 2, 2],
  ],
  seaking_cowl: [[-2.7, 1.42, 0.3, 0.1, 2, 2], [-2.3, 1.52, 1.6, 0.62, 2.5, 4], [2.2, 1.58, 1.72, 0.82, 3, 5], [3.2, 1.5, 1.2, 0.5, 2.6, 4], [3.5, 1.44, 0.3, 0.1, 2, 2]],
  // OSPREY: a tiltrotor: a fat cabin, a high wing with a rotor at each tip, a twin-fin tail and a loading ramp
  osprey: [
    [-7.0, -0.2, 0.06, 0.06, 2, 2], [-6.8, -0.18, 0.9, 0.8, 2.2, 2.2], [-6.3, -0.1, 1.6, 1.5, 2.4, 2.6], [-5.5, 0.0, 2.2, 2.1, 2.8, 3.4],
    [-4.5, 0.05, 2.5, 2.5, 3.6, 4.6], [4.2, 0.1, 2.5, 2.5, 3.6, 4.6], [5.8, 0.35, 2.2, 1.9, 3.2, 3.8], [7.1, 0.62, 1.5, 1.1, 2.8, 3], [7.5, 0.72, 0.3, 0.3, 2, 2],
  ],
  // HARRIER: a jump jet. A pointed nose, a bubble canopy, big intakes, shoulder wings, four swivelling nozzles
  harrier: [
    [-6.6, -0.15, 0.05, 0.05, 2, 2], [-6.3, -0.13, 0.4, 0.42, 2.1, 2.1], [-5.6, -0.1, 0.8, 0.85, 2.3, 2.4], [-4.6, -0.05, 1.1, 1.15, 2.5, 2.6],
    [-3.6, 0.0, 1.3, 1.35, 2.8, 3], [-1.0, 0.0, 1.8, 1.45, 3.4, 3.6], [2.0, 0.05, 1.7, 1.4, 3.2, 3.4], [4.5, 0.2, 1.1, 1.0, 2.6, 2.6], [7.0, 0.35, 0.5, 0.5, 2.2, 2.2], [7.4, 0.4, 0.06, 0.06, 2, 2],
  ],
  harrier_c: [[-4.7, 0.42, 0.1, 0.08, 2, 2], [-4.35, 0.55, 0.72, 0.55, 2.4, 3], [-3.6, 0.7, 0.84, 0.76, 2.6, 3], [-2.7, 0.66, 0.78, 0.66, 2.6, 3], [-2.3, 0.55, 0.4, 0.3, 2, 2]],
  // ALLIGATOR: a broad nose for two pilots side by side, a slim tail
  alligator: [
    [-5.0, -0.4, 0.06, 0.06, 2, 2], [-4.85, -0.36, 0.7, 0.6, 2.2, 2.2], [-4.3, -0.25, 1.3, 1.1, 2.4, 2.6], [-3.4, -0.15, 1.75, 1.5, 2.8, 3.2],
    [-1.5, -0.1, 1.8, 1.6, 3.2, 3.6], [0.8, -0.05, 1.6, 1.5, 3, 3.4], [2.0, 0.15, 1.0, 1.0, 2.5, 2.5], [6.2, 0.3, 0.5, 0.6, 2.2, 2.2], [6.9, 0.35, 0.36, 0.46, 2, 2], [7.05, 0.35, 0.05, 0.05, 2, 2],
  ],
  alligator_c: [[-4.45, 0.12, 0.1, 0.08, 2, 2], [-4.15, 0.28, 1.3, 0.62, 2.4, 3], [-3.3, 0.52, 1.62, 0.92, 2.6, 3], [-2.3, 0.58, 1.56, 0.86, 2.6, 3], [-1.85, 0.48, 0.8, 0.4, 2, 2]],
  // SKYCRANE: a glassy cab up front, then just a thin spine back to the tail
  skycrane: [
    [-6.0, -0.15, 0.06, 0.06, 2, 2], [-5.8, -0.1, 1.2, 1.3, 2.2, 2.2], [-5.2, 0.0, 2.0, 2.0, 2.5, 2.8], [-4.2, 0.1, 2.1, 2.1, 3, 3.4], [-3.3, 0.35, 1.3, 1.1, 2.6, 2.8],
    [-2.6, 0.65, 0.95, 0.8, 2.6, 3], [3.6, 0.7, 0.9, 0.8, 2.6, 3], [6.0, 0.85, 0.6, 0.6, 2.3, 2.3], [9.4, 1.05, 0.45, 0.45, 2.1, 2.1], [9.75, 1.05, 0.05, 0.05, 2, 2],
  ],
  // WARTHOG: a blunt, boxy attack plane: a long nose with the cannon under it, a bubble canopy, a thick body
  warthog: [
    [-6.6, -0.25, 0.05, 0.05, 2, 2], [-6.4, -0.24, 0.62, 0.7, 2.3, 2.6], [-5.6, -0.15, 1.2, 1.3, 2.6, 3], [-4.4, -0.06, 1.45, 1.6, 2.8, 3.2],
    [-2.0, 0.0, 1.5, 1.7, 3, 3.4], [2.0, 0.05, 1.3, 1.5, 3, 3.2], [5.0, 0.2, 0.9, 1.0, 2.6, 2.6], [7.2, 0.35, 0.5, 0.6, 2.2, 2.2], [7.6, 0.4, 0.05, 0.05, 2, 2],
  ],
  warthog_c: [[-5.0, 0.55, 0.1, 0.08, 2, 2], [-4.7, 0.72, 0.82, 0.5, 2.4, 3], [-4.0, 0.88, 0.92, 0.7, 2.6, 3], [-3.25, 0.82, 0.86, 0.6, 2.6, 3], [-2.85, 0.66, 0.4, 0.3, 2, 2]],
  engine_pod: [[-1.6, 0, 0.1, 0.1, 2, 2], [-1.45, 0, 1.05, 1.05, 2, 2], [-0.9, 0, 1.15, 1.15, 2, 2], [0.9, 0, 1.0, 1.0, 2, 2], [1.4, 0, 0.7, 0.7, 2, 2], [1.5, 0, 0.5, 0.5, 2, 2]],
  // SPECTRE: a big four-engine transport turned gunship: a fat round body, a high wing, a tall tail that sweeps up
  spectre: [
    [-9.2, -0.3, 0.08, 0.08, 2, 2], [-9.0, -0.25, 1.6, 1.4, 2.2, 2.2], [-8.4, -0.1, 2.6, 2.5, 2.4, 2.6], [-7.4, 0.0, 3.2, 3.1, 2.8, 3],
    [-6.0, 0.05, 3.4, 3.3, 3, 3.2], [5.0, 0.1, 3.4, 3.3, 3, 3.2], [7.0, 0.5, 2.6, 2.4, 2.8, 3], [9.0, 1.2, 1.4, 1.2, 2.4, 2.4], [10.2, 1.6, 0.6, 0.6, 2.2, 2.2], [10.5, 1.65, 0.05, 0.05, 2, 2],
  ],
  // LYNX: a sleek little utility helicopter, rounded nose, slim boom
  lynx: [
    [-4.6, -0.35, 0.06, 0.06, 2, 2], [-4.45, -0.32, 0.9, 0.9, 2.2, 2.2], [-4.1, -0.22, 1.5, 1.5, 2.4, 2.6], [-3.5, -0.12, 1.86, 1.86, 2.8, 3.4],
    [-2.7, -0.05, 2.0, 2.0, 3.2, 4], [1.0, 0, 2.0, 2.0, 3.2, 4], [1.8, 0.18, 1.5, 1.4, 2.8, 3], [2.6, 0.42, 0.8, 0.8, 2.3, 2.3],
    [6.6, 0.6, 0.5, 0.55, 2.1, 2.1], [7.2, 0.65, 0.36, 0.42, 2, 2], [7.35, 0.65, 0.05, 0.05, 2, 2],
  ],
  lynx_cowl: [[-1.2, 1.0, 0.2, 0.08, 2, 2], [-0.9, 1.06, 1.2, 0.5, 2.5, 4], [1.2, 1.12, 1.3, 0.6, 3, 5], [2.0, 1.02, 0.8, 0.4, 2.6, 4], [2.3, 0.96, 0.2, 0.1, 2, 2]],
  // STALLION: a long, low, wide troop carrier with a flat bottom and a big engine deck
  stallion: [
    [-5.7, -0.45, 0.06, 0.06, 2, 2], [-5.55, -0.42, 0.9, 0.8, 2.2, 2.2], [-5.2, -0.32, 1.6, 1.4, 2.4, 2.8], [-4.6, -0.2, 2.1, 1.9, 2.8, 3.6],
    [-3.8, -0.1, 2.3, 2.0, 3.4, 4.6], [1.8, -0.05, 2.3, 2.0, 3.4, 4.6], [2.8, 0.15, 1.8, 1.5, 3, 3.4], [3.8, 0.42, 1.0, 0.9, 2.4, 2.4],
    [8.2, 0.6, 0.6, 0.62, 2.1, 2.1], [9.6, 0.9, 0.45, 0.5, 2, 2], [9.8, 0.9, 0.05, 0.05, 2, 2],
  ],
  stallion_cowl: [[-2.0, 1.0, 0.3, 0.1, 2, 2], [-1.6, 1.07, 1.7, 0.5, 2.6, 4], [1.5, 1.15, 1.8, 0.7, 3, 5], [2.6, 1.05, 1.2, 0.5, 2.6, 4], [3.0, 0.95, 0.3, 0.12, 2, 2]],
  // BRONCO: a short pod for two under a big glass canopy, the tail carried on two booms
  bronco: [
    [-4.4, -0.2, 0.05, 0.05, 2, 2], [-4.2, -0.18, 0.6, 0.7, 2.2, 2.4], [-3.5, -0.1, 1.0, 1.2, 2.5, 2.8], [-2.5, 0, 1.15, 1.4, 2.8, 3],
    [0.8, 0.05, 1.15, 1.4, 2.8, 3], [2.0, 0.1, 0.8, 0.9, 2.4, 2.4], [2.8, 0.15, 0.3, 0.3, 2, 2], [2.9, 0.15, 0.05, 0.05, 2, 2],
  ],
  bronco_c: [[-3.6, 0.42, 0.1, 0.08, 2, 2], [-3.3, 0.6, 0.9, 0.6, 2.4, 3], [-1.5, 0.85, 1.0, 0.86, 2.6, 3], [0.4, 0.8, 0.96, 0.7, 2.6, 3], [0.9, 0.6, 0.4, 0.3, 2, 2]],
  bronco_boom: [[-1.9, 0, 0.1, 0.1, 2, 2], [-1.7, 0, 0.75, 0.85, 2, 2], [0, 0, 0.75, 0.85, 2, 2], [2, 0.05, 0.5, 0.55, 2, 2], [6.5, 0.1, 0.32, 0.36, 2, 2], [6.6, 0.1, 0.05, 0.05, 2, 2]],
  // PELICAN: a flying boat: a deep boat hull with a vee bottom and a step, the tail swept up out of the water
  pelican: [
    [-6.2, -0.3, 0.06, 0.06, 2, 2], [-6.0, -0.25, 1.0, 1.2, 2.2, 1.6], [-5.2, -0.1, 2.0, 2.4, 2.6, 1.5], [-3.8, 0, 2.4, 2.8, 3, 1.5],
    [0.5, 0, 2.4, 2.8, 3, 1.5], [1.0, 0.25, 2.3, 2.3, 3, 1.8], [4.0, 0.7, 1.4, 1.4, 2.6, 2], [7.2, 1.1, 0.6, 0.6, 2, 2], [7.6, 1.15, 0.05, 0.05, 2, 2],
  ],
  pelican_c: [[-4.9, 1.0, 0.1, 0.08, 2, 2], [-4.6, 1.2, 1.6, 0.6, 2.4, 3], [-3.4, 1.42, 1.8, 0.62, 2.6, 3], [-2.6, 1.4, 1.6, 0.45, 2.4, 3], [-2.3, 1.35, 0.3, 0.1, 2, 2]],
  // MOSQUITO: a slim wooden twin-engine fighter-bomber, a glass nose for the bomb aimer
  mosquito: [
    [-5.6, -0.5, 0.05, 0.05, 2, 2], [-5.3, -0.5, 0.8, 0.9, 2.2, 2.2], [-4.4, -0.45, 1.3, 1.45, 2.4, 2.4], [-2.5, -0.4, 1.45, 1.6, 2.6, 2.4],
    [0.5, -0.45, 1.35, 1.5, 2.6, 2.4], [3.5, -0.3, 0.8, 0.9, 2.2, 2.2], [6.2, -0.15, 0.4, 0.5, 2, 2], [6.5, -0.15, 0.05, 0.05, 2, 2],
  ],
  mosquito_c: [[-3.9, 0.15, 0.1, 0.08, 2, 2], [-3.6, 0.3, 0.9, 0.5, 2.4, 3], [-2.6, 0.45, 1.0, 0.55, 2.6, 3], [-1.6, 0.35, 0.7, 0.35, 2.4, 3], [-1.3, 0.28, 0.2, 0.08, 2, 2]],
  // FALCON: a fighter: a long pointed nose, a bubble canopy, a body that blends into the wing roots
  falcon: [
    [-7.6, 0, 0.04, 0.04, 2, 2], [-7.2, 0, 0.4, 0.42, 2.2, 2.2], [-6.0, 0.02, 0.9, 0.95, 2.4, 2.4], [-4.6, 0.05, 1.2, 1.25, 2.6, 2.6],
    [-3.0, 0, 1.4, 1.4, 2.8, 3.2], [-1, -0.05, 1.7, 1.45, 3.2, 3.6], [3.0, 0, 1.7, 1.35, 3.2, 3.4], [5.6, 0.05, 1.2, 1.1, 2.6, 2.6],
    [6.8, 0.05, 0.95, 0.95, 2.2, 2.2], [7.0, 0.05, 0.85, 0.85, 2, 2],
  ],
  falcon_c: [[-5.2, 0.45, 0.1, 0.08, 2, 2], [-4.8, 0.6, 0.7, 0.5, 2.4, 3], [-3.6, 0.85, 0.8, 0.7, 2.6, 3], [-2.4, 0.82, 0.76, 0.6, 2.6, 3], [-1.6, 0.6, 0.4, 0.3, 2, 2]],
  falcon_intake: [[-3.2, 0, 0.1, 0.1, 2, 2], [-3.1, 0, 1.0, 0.7, 2.6, 2.6], [-1.0, 0, 1.0, 0.7, 2.6, 2.6], [1.0, 0.1, 0.7, 0.4, 2.4, 2.4], [1.6, 0.2, 0.1, 0.1, 2, 2]],
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
  kestrel: [[50, 88, -5.2, -3.95], [60, 87, -3.85, -3.2], [8, 46, -4.75, -3.25], [226, 252, -5.22, -4.55], [14, 36, -2.2, -1.4], [14, 36, -0.6, 0.2], [14, 36, 1.0, 1.8]],
  viper: [],
  huey: [[46, 89, -4.2, -3.15], [62, 88, -3.1, -2.55], [4, 46, -3.95, -2.75], [220, 258, -4.15, -3.35]],
  seaking: [[48, 89, -5.85, -4.75], [6, 44, -5.45, -4.35], [228, 256, -5.95, -5.3], [16, 32, -2.9, -2.3], [16, 32, -1.5, -0.9], [16, 32, -0.1, 0.5], [16, 32, 1.3, 1.9]],
  osprey: [[46, 89, -6.65, -5.55], [6, 44, -6.25, -5.15], [226, 256, -6.8, -6.1], [16, 32, -3.5, -3.0], [16, 32, -1.5, -1.0], [16, 32, 0.5, 1.0]],
  harrier: [],
  warthog: [],
  spectre: [[46, 89, -8.85, -7.6], [8, 44, -8.5, -7.4], [226, 256, -9.0, -8.3]],
  alligator: [],
  skycrane: [[40, 89, -5.85, -4.3], [4, 46, -5.4, -3.6], [220, 258, -5.9, -4.6]],
  mule: [[42, 88, -7.5, -6.62], [228, 256, -7.56, -7.02], [12, 40, -7.12, -6.3]],
  lynx: [[50, 88, -4.4, -3.0], [8, 46, -4.0, -2.7], [226, 252, -4.45, -3.7], [14, 38, -1.8, -0.6]],
  stallion: [[50, 88, -5.4, -4.1], [8, 46, -5.0, -3.9], [226, 254, -5.55, -4.8], [14, 34, -3.3, -2.5], [14, 34, -0.6, 0.4]],
  bronco: [], falcon: [], pelican: [], mosquito: [],
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
  G.g_reaper_c1 = loft(SEC.reaper_c1, 40); G.g_reaper_c2 = loft(SEC.reaper_c2, 40); G.g_viper_c = loft(SEC.viper_c, 40); G.g_harrier_c = loft(SEC.harrier_c, 40); G.g_warthog_c = loft(SEC.warthog_c, 40); G.g_bronco_c = loft(SEC.bronco_c, 40); G.g_pelican_c = loft(SEC.pelican_c, 40); G.g_mosquito_c = loft(SEC.mosquito_c, 40); G.g_falcon_c = loft(SEC.falcon_c, 40); G.g_alligator_c = loft(SEC.alligator_c, 40);
  Object.assign(G, decalGeometries());
  return G;
}

// ---- nose art and tail markings: shapes drawn in (distance back from the nose / boom position, angle) and wrapped
// onto the skin, a few cm proud of it. One mesh per airframe, design and colour: d_<kind>_<design>_<colour index>.
// where each airframe's nose starts, its tail boom runs, where the number goes, and how big its nose is
const DEC = {
  warhorse: { boom: [3.9, 7.4], num: 1.85, ns: 1 },
  hornet: { boom: [1.5, 4.4], num: -0.1, ns: 0.72 },
  reaper: { boom: [2.6, 6.2], num: 0.9, ns: 0.85 },
  mule: { boom: [3.2, 5.4], num: 4.4, ns: 1.35 },
  kestrel: { boom: [5.2, 9.2], num: 3.0, ns: 1.1 },
  viper: { boom: [2.8, 6.2], num: 1.2, ns: 0.85 },
  huey: { boom: [3.0, 7.6], num: 1.6, ns: 1.05 },
  seaking: { boom: [6.2, 9.6], num: 2.6, ns: 1.25 },
  osprey: { boom: [4.6, 7.0], num: 1.4, ns: 1.2 },
  harrier: { boom: [3.0, 6.6], num: 0.6, ns: 0.9 },
  warthog: { boom: [3.0, 6.8], num: -1.0, ns: 0.95 },
  spectre: { boom: [5.4, 9.4], num: -5.0, ns: 1.4 },
  alligator: { boom: [2.6, 6.2], num: 0.9, ns: 0.9 },
  skycrane: { boom: [4.0, 9.0], num: -4.1, ns: 1.1 },
  lynx: { boom: [2.8, 6.8], num: 0.9, ns: 0.95 },
  stallion: { boom: [4.0, 9.2], num: 2.0, ns: 1.1 },
  bronco: { boom: [1.6, 2.6], num: -1.0, ns: 0.8 },
  falcon: { boom: [3.0, 6.6], num: -2.0, ns: 0.9 },
  pelican: { boom: [3.5, 7.0], num: -1.5, ns: 1.2 },
  mosquito: { boom: [2.5, 6.0], num: 1.0, ns: 0.85 },
};
export const DECAL_COLS = {
  shark: [[0.72, 0.07, 0.06], [0.93, 0.93, 0.9], [0.04, 0.04, 0.05]],
  flames: [[1, 0.42, 0.06], [1, 0.82, 0.12]],
  skull: [[0.92, 0.92, 0.88], [0.04, 0.04, 0.05]],
  checks: [[0.06, 0.06, 0.07], [0.92, 0.92, 0.9]],
  stripes: [[0.92, 0.92, 0.9], [0.05, 0.05, 0.06]],
  bands: [[1, 0.42, 0.04]],
  number: [[0.9, 0.9, 0.86]],
  bolt: [[1, 0.82, 0.08]],
  star: [[0.1, 0.15, 0.38], [0.93, 0.93, 0.9]],
  tchecks: [[0.06, 0.06, 0.07], [0.92, 0.92, 0.9]],
  sunburst: [[0.95, 0.35, 0.08], [1, 0.8, 0.15]],
};
function sampler(S) {
  const K = skin(S, 96, 10), R = K.R;
  const pt = (thDeg, z) => {
    let i = 0; while (i < R.length - 2 && R[i + 1][0] < z) i++;
    const a = R[i], b = R[i + 1], f = Math.max(0, Math.min(1, (z - a[0]) / (b[0] - a[0] || 1)));
    const th = thDeg * Math.PI / 180, pa = ringPoint(a, th), pb = ringPoint(b, th);
    return [pa[0] + (pb[0] - pa[0]) * f, pa[1] + (pb[1] - pa[1]) * f, z];
  };
  return (thDeg, z, off) => {
    const p = pt(thDeg, z), u = pt(thDeg + 0.5, z), v = pt(thDeg - 0.5, z), w = pt(thDeg, z + 0.02), q = pt(thDeg, z - 0.02);
    const A = [u[0] - v[0], u[1] - v[1], u[2] - v[2]], B = [w[0] - q[0], w[1] - q[1], w[2] - q[2]];
    let n = [A[1] * B[2] - A[2] * B[1], A[2] * B[0] - A[0] * B[2], A[0] * B[1] - A[1] * B[0]];
    let cy = 0; for (let i = 0; i < R.length - 1; i++) if (R[i][0] <= z) cy = R[i][1];
    if (n[0] * p[0] + n[1] * (p[1] - cy) < 0) n = n.map((x) => -x);
    const l = Math.hypot(...n) || 1; n = n.map((x) => x / l);
    return { p: [p[0] + n[0] * off, p[1] + n[1] * off, p[2] + n[2] * off], n };
  };
}
// a list of polygons in (z, angle) -> one mesh: each polygon fanned from its middle, each fan triangle split up finely
// so it follows the curve of the skin
function wrap(at, polys, off) {
  const P = [], N = [], q = [];
  for (const poly of polys) {
    const c = poly.reduce((a, b) => [a[0] + b[0] / poly.length, a[1] + b[1] / poly.length], [0, 0]);
    for (let e = 0; e < poly.length; e++) {
      const A = c, Bp = poly[e], C = poly[(e + 1) % poly.length], n = 4;
      const base = P.length, idx = {};
      for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) {
        const u = i / n, v = j / n, z = A[0] + (Bp[0] - A[0]) * u + (C[0] - A[0]) * v, th = A[1] + (Bp[1] - A[1]) * u + (C[1] - A[1]) * v;
        const s = at(th, z, off); idx[i + ',' + j] = P.length; P.push(s.p); N.push(s.n);
      }
      for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) {
        q.push([idx[i + ',' + j], idx[(i + 1) + ',' + j], idx[i + ',' + (j + 1)], idx[i + ',' + (j + 1)]]);
        if (i + j < n - 1) q.push([idx[(i + 1) + ',' + j], idx[(i + 1) + ',' + (j + 1)], idx[i + ',' + (j + 1)], idx[i + ',' + (j + 1)]]);
      }
      void base;
    }
  }
  return build(P, N, q, 0);
}
// both sides: phi is degrees below the side line on the right (negative = above); the left side mirrors it
const sides = (poly) => [poly.map(([z, ph]) => [z, -ph]), poly.map(([z, ph]) => [z, 180 + ph])];
const circle = (z, ph, rz, rp, n = 12) => Array.from({ length: n }, (_, k) => [z + Math.cos(k / n * 6.283) * rz, ph + Math.sin(k / n * 6.283) * rp]);
const SEG7 = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcfgd' };
function designs(kind, S) {
  const D = DEC[kind], tip = S[0][0], ns = D.ns, out = {};
  const lerpLip = (pts, d) => { for (let i = 0; i < pts.length - 1; i++) if (d >= pts[i][0] && d <= pts[i + 1][0]) { const f = (d - pts[i][0]) / (pts[i + 1][0] - pts[i][0]); return pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f; } return pts[pts.length - 1][1]; };
  const N = (d) => tip + d * ns;
  // shark mouth: red mouth, white teeth top and bottom, an eye above the corner
  const up = [[0.32, 22], [0.55, 8], [0.95, 2], [1.45, 6], [1.62, 14]], lo = [[0.32, 22], [0.55, 40], [0.95, 42], [1.45, 30], [1.62, 14]];
  const mouth = [...up, ...lo.slice(1, -1).reverse()].map(([d, p]) => [N(d), p]);
  const teeth = [];
  for (let d = 0.5; d < 1.42; d += 0.16) {
    teeth.push([[N(d), lerpLip(up, d)], [N(d + 0.16), lerpLip(up, d + 0.16)], [N(d + 0.08), lerpLip(up, d + 0.08) + 9]]);
    teeth.push([[N(d), lerpLip(lo, d)], [N(d + 0.08), lerpLip(lo, d + 0.08) - 9], [N(d + 0.16), lerpLip(lo, d + 0.16)]]);
  }
  out.shark = [sides(mouth), teeth.flatMap(sides), sides(circle(N(1.78), -8, 0.065 * ns, 3))];
  out.sharkEye = [...sides(circle(N(1.75), -8, 0.15 * ns, 6.5))];
  // flames: tongues licking back from the nose, orange with yellow inside
  const tongues = (sc) => { const t = []; for (let k = 0; k < 5; k++) { const p0 = -24 + k * 12, len = (1.4 + ((k * 37) % 5) * 0.25) * sc; t.push([[N(0.15), p0], [N(0.15 + len * 0.45), p0 + 2.5], [N(0.15 + len), p0 + 6 + (k % 2 ? 3 : -2)], [N(0.15 + len * 0.55), p0 + 10], [N(0.15), p0 + 11]]); } return t; };
  out.flames = [tongues(1).flatMap(sides), tongues(0.62).map((t) => t.map(([z, p], i) => [z, p + (i === 0 || i === 4 ? (i ? -2.5 : 2.5) : 0)])).flatMap(sides)];
  // a skull and crossed bones
  const sz = N(1.15), sp = 6;
  out.skull = [[...sides(circle(sz, sp, 0.27 * ns, 13)), ...sides([[sz - 0.15 * ns, sp + 9], [sz + 0.15 * ns, sp + 9], [sz + 0.13 * ns, sp + 18], [sz - 0.13 * ns, sp + 18]]),
    ...sides([[sz - 0.45 * ns, sp + 20], [sz - 0.38 * ns, sp + 24], [sz + 0.45 * ns, sp + 8], [sz + 0.38 * ns, sp + 4]]), ...sides([[sz + 0.45 * ns, sp + 20], [sz + 0.38 * ns, sp + 24], [sz - 0.45 * ns, sp + 8], [sz - 0.38 * ns, sp + 4]])],
    [...sides(circle(sz - 0.1 * ns, sp + 2, 0.075 * ns, 4)), ...sides(circle(sz + 0.1 * ns, sp + 2, 0.075 * ns, 4)), ...sides([[sz, sp + 6], [sz - 0.04 * ns, sp + 9], [sz + 0.04 * ns, sp + 9]])]];
  // a chequered nose
  const ck = [[], []];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 16; j++) { const z0 = N(0.06 + i * 0.22), z1 = N(0.06 + (i + 1) * 0.22), a0 = j * 22.5, a1 = a0 + 22.5; ck[(i + j) % 2].push([[z0, a0], [z1, a0], [z1, a1], [z0, a1]]); }
  out.checks = ck;
  // invasion stripes round the tail boom, and dayglo rescue bands
  const [b0, b1] = D.boom, L = b1 - b0, ring = (z0, z1) => { const r = []; for (let j = 0; j < 12; j++) r.push([[z0, j * 30], [z1, j * 30], [z1, j * 30 + 30], [z0, j * 30 + 30]]); return r; };
  const w = L * 0.08;
  out.stripes = [[0, 2, 4].flatMap((k) => ring(b0 + L * 0.15 + k * w, b0 + L * 0.15 + (k + 1) * w)), [1, 3].flatMap((k) => ring(b0 + L * 0.15 + k * w, b0 + L * 0.15 + (k + 1) * w))];
  out.bands = [[...ring(b0 + L * 0.2, b0 + L * 0.32), ...ring(b0 + L * 0.62, b0 + L * 0.74)]];
  // a lightning bolt down each side of the nose
  out.bolt = [[[[N(0.7), -14], [N(2.1), -6], [N(1.85), 2]], [[N(1.7), -4], [N(3.3), 12], [N(2.05), 4]]].flatMap(sides)];
  // a star in a blue disc on the cabin sides
  const stz = D.num - 1.1 * ns, star = Array.from({ length: 10 }, (_, k) => { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 0.42 : 1; return [stz + Math.cos(a) * 0.34 * ns * r, -2 + Math.sin(a) * 11 * r]; });
  out.star = [sides(circle(stz, -2, 0.42 * ns, 14, 18)), sides(star)];
  // a chequered band round the tail boom
  const tc = [[], []];
  for (let i = 0; i < 2; i++) for (let j = 0; j < 12; j++) { const z0 = b0 + L * 0.4 + i * L * 0.08, z1 = z0 + L * 0.08; tc[(i + j) % 2].push([[z0, j * 30], [z1, j * 30], [z1, j * 30 + 30], [z0, j * 30 + 30]]); }
  out.tchecks = tc;
  // a sunburst: rays fanning back from the nose, orange and yellow
  const rays = [[], []];
  for (let k = 0; k < 7; k++) { const p0 = -30 + k * 10; rays[k % 2].push([[N(0.2), p0 + 4], [N(2.4), p0 - 2], [N(2.4), p0 + 6]]); }
  out.sunburst = [rays[0].flatMap(sides), rays[1].flatMap(sides)];
  return out;
}
// the tail number: two digits on each side of the cabin, made of seven-segment bars
function digitPolys(kind, S, pos, dgt) {
  const D = DEC[kind], z0 = D.num, hp = 13 * (kind === 'hornet' || kind === 'viper' ? 1.25 : kind === 'mule' ? 0.9 : 1), wz = 0.28, t = 0.06;
  // segment rectangles in (reading x 0..1, height 0..1, 0 = top)
  const SG = { a: [0, 0, 1, t / 0.5], b: [1 - t / wz, 0, 1, 0.5], c: [1 - t / wz, 0.5, 1, 1], d: [0, 1 - t / 0.5, 1, 1], e: [0, 0.5, t / wz, 1], f: [0, 0, t / wz, 0.5], g: [0, 0.5 - t / 1, 1, 0.5 + t / 1] };
  const polys = [];
  for (const side of [1, -1]) {
    const x0 = pos * (wz + 0.1) - (wz + 0.05);
    for (const c of SEG7[dgt]) {
      const [rx0, ry0, rx1, ry1] = SG[c];
      const zA = z0 - side * (x0 + rx0 * wz), zB = z0 - side * (x0 + rx1 * wz), pA = -hp + ry0 * hp * 2 * 0.5 - 2, pB = -hp + ry1 * hp * 2 * 0.5 - 2;
      const poly = [[zA, pA], [zB, pA], [zB, pB], [zA, pB]].map(([z, p]) => [z, side > 0 ? -p : 180 + p]);
      polys.push(poly);
    }
  }
  void S;
  return polys;
}
export function decalGeometries() {
  const G = {};
  for (const kind of Object.keys(DEC)) {
    const S = SEC[kind], at = sampler(S), d = designs(kind, S);
    const put = (name, lists) => lists.forEach((polys, i) => { if (polys.length) G[`d_${kind}_${name}_${i}`] = wrap(at, polys, 0.02 + i * 0.004); });
    put('shark', [d.shark[0], d.shark[1], d.shark[2]]);
    G[`d_${kind}_shark_3`] = wrap(at, d.sharkEye, 0.021);
    put('flames', d.flames); put('skull', d.skull); put('checks', d.checks); put('stripes', d.stripes); put('bands', d.bands);
    put('bolt', d.bolt); put('star', d.star); put('tchecks', d.tchecks); put('sunburst', d.sunburst);
    for (let pos = 0; pos < 2; pos++) for (let n = 0; n < 10; n++) G[`d_${kind}_num${pos}_${n}`] = wrap(at, digitPolys(kind, S, pos, String(n)), 0.024);
  }
  return G;
}
