# DEAD AIR

A third-person helicopter shooter in an open world full of zombies. Plain JavaScript modules and WebGL2, no build step: open `index.html` from any web server.

**The published copy is locked, like The Semi-Finals.** `docs/` is what GitHub Pages serves (Settings → Pages → branch `main`, folder `/docs`): it looks like GitHub's "There isn't a GitHub Pages site here." page. Type the secret word anywhere (on a phone, tap the grey logo five times) and the password screen fades in; the password unscrambles the game (`docs/g.bin`, AES-256-GCM, key from PBKDF2). Same word and password as The Semi-Finals. A device that's unlocked once goes straight in (add `?lock` to forget). After changing the game, rebuild it with `python3 tools/seal.py` (reads the git-ignored `.sealpass` and `.sealword`).

**Flying**: three styles, picked in the hangar. EASY (the default): the mouse steers (left/right turns, forward/back flies forward/back), A / D slide sideways, W / S up and down, it hovers when you let go, crashes hurt less and the gun helps you aim. ASSIST and PRO fly like Battlefield 2042 (mouse tilts, A / D turn; PRO has no levelling). Click: nose gun · right click: rockets · Space: bombs · Shift: afterburner · V: siren (with the loudspeaker) · C: camera.

**The world**: 6.4 km across and made from a seed, so every NEW WORLD (in the hangar) is different, and friends who join get the same one. Mountain ranges with snow on top, rivers winding through valleys, lakes, forests of thousands of trees (you can crash into them), farmland, farms, 22 named towns and villages, two small cities, and THE CITY: an island 2 km long between two wide rivers, laid out like Manhattan, with skyscrapers up to 300 m in Downtown and Midtown, a big park with a lake, Times Square neon, jammed avenues, walk-ups with fire escapes, ships in the river, and two huge suspension bridges (one to THE BOROUGH, rows of brownstones across the east river). Press M for the map. Your one base is THE SPIRE: a landing pad sticking out of the side of a tower in Midtown.

**Day and night**: a day lasts 12 minutes. At night it's properly dark: stars, a moon, the city's windows and neon lit up, more zombies and faster ones, and kills pay 50% more. Fit a SEARCHLIGHT (L).

**Zombies**: just infected people, but thousands of them (the city streets are packed, the countryside much less): walkers, runners, crawlers (can't climb) and screamers (they shriek and the whole horde comes). They can't fly or spit: they climb on top of each other. A pile builds up against a wall until the top ones reach the roof, and a heap forms under you if you hover low and slow. Spikes on the skids (ANTI-CLIMB) knock grabbers off.

**Your team**: TEAM (T) at the Spire. Recruit people (name them, pick a job: rifleman, medic, scavenger, breacher, scout), buy guns, armour, medkits, grenades and backpacks in the armoury and hand them out. Land on a building with a lit sign (pharmacy, police, gas station, hospital, gun shop…) and press R to send whoever's on board in, from the roof or the street door. The tracker shows them clearing it floor by floor; tell them to meet you on the ROOF (Y) or the STREET (U), or PULL OUT (K). Pick them up (E) and they bring back scrap, fuel, gear and survivors. Bitten team members don't come back.

**Events**: RESCUE (people on a roof under a green flare, with a pile growing up the wall), BRIDGE (a crowd stuck in the traffic on a bridge, the dead walking in from both ends), HORDE (hundreds of them walking across the country towards a named town: break it up with bombs and rockets before it gets there) and SUPPLY DROP (hook it on and take it to the Spire).

**Helicopters** (HELICOPTER in the hangar): WARHORSE (the all-rounder, fits everything), HORNET (a tiny fast scout with benches outside, can't fit the heaviest upgrades), REAPER (a gunship: tandem cockpit, chin gun +30% damage, +50% rockets, heavy armour, two seats, no doors) and MULE (a twin-rotor transport: 16 to 32 seats, huge fuel, very tough, slow, no rockets). Upgrades are bought once and fit any helicopter they're not too big for.

**Upgrades** (each tier changes how the helicopter looks; tiers go grey → green → blue → purple → orange): nose gun (up to RAILGUN and LASER), rockets (up to SWARM PODS), bombs (up to the MINI NUKE), armour (up to TITANIUM), engine (up to JET TURBINES), rotor (up to the SHREDDER), door gunners, fuel tanks (up to the FUEL RECYCLER), cabin (up to 16 seats, 40 on the Mule), winch (up to the ZOMBIE MAGNET, J), thermal camera, loudspeaker (up to the SONIC CANNON), skids (anti-climb, then electric), searchlight, belly turret, medical bay (up to the FIELD HOSPITAL), supply chutes (B), radio (up to the DRONE UPLINK), TAIL GUN, FLASH PODS (X: stun everything near you and shake off climbers) and NOISE BEACONS (N: drop a beacon every zombie walks to; the BOOM ones blow up). The hangar shows what each tier does to your health, firepower, fuel and seats.

**Fuel**: runs down as you fly. Refuel at the Spire, bring it back from gas stations, send passengers out for it (Q) or pay for a fuel drop (G).

**Online**: friends join as door gunners: TEAM → INVITE FRIENDS for a code, friends press JOIN A FRIEND on the title screen (`?net=local` tests it in two tabs).

Code: `src/heli/`: `game.js` (hangar, flying, landing, raids, HUD, the friend's view), `terrain.js` (the procedural land, streamed in chunks), `trees.js` (the forests), `map.js` (city, towns, the Spire), `horde.js` (zombies and piles), `team.js` (team, gear, raids), `events.js`, `chopper.js` (model and flight), `coop.js` (online), `data.js` (upgrades, save), `ui.js` (styles). The renderer and helpers in `src/` come from The Semi-Finals.

`mech.html` is the earlier mech sketch.
