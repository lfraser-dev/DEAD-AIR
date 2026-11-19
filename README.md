# DEAD AIR

A third-person helicopter shooter in an open world full of zombies. Plain JavaScript modules and WebGL2, no build step: open `index.html` from any web server (or GitHub Pages).

**Flying**: three styles, picked in the hangar. EASY (the default): the mouse steers (left/right turns, forward/back flies forward/back), A / D slide sideways, W / S up and down, it hovers when you let go, crashes hurt less and the gun helps you aim. ASSIST and PRO fly like Battlefield 2042 (mouse tilts, A / D turn; PRO has no levelling). Click: nose gun · right click: rockets · Space: bombs · Shift: afterburner · V: siren (with the loudspeaker) · C: camera.

**The world**: made from a seed, so every NEW WORLD (in the hangar) is different, and friends who join get the same one. Hills, lakes, a ring of mountains, woods, farms, small towns and one big burning city, joined by roads. Your one base is THE SPIRE: a landing pad sticking out of the side of a huge tower, with fuel, repairs, the hangar and your team.

**Zombies**: just infected people, but lots of them: walkers, runners, crawlers (can't climb) and screamers (they shriek and the whole horde comes). They can't fly or spit: they climb on top of each other. A pile builds up against a wall until the top ones reach the roof, and a heap forms under you if you hover low and slow. Spikes on the skids (ANTI-CLIMB) knock grabbers off.

**Your team**: TEAM (T) at the Spire. Recruit people (name them, pick a job: rifleman, medic, scavenger, breacher, scout), buy guns, armour, medkits, grenades and backpacks in the armoury and hand them out. Land on a building with a lit sign (pharmacy, police, gas station, hospital, gun shop…) and press R to send whoever's on board in, from the roof or the street door. The tracker shows them clearing it floor by floor; tell them to meet you on the ROOF (Y) or the STREET (U), or PULL OUT (K). Pick them up (E) and they bring back scrap, fuel, gear and survivors. Bitten team members don't come back.

**Events**: RESCUE (people on a roof under a green flare, with a pile growing up the wall) and SUPPLY DROP (hook it on and take it to the Spire).

**Fuel**: runs down as you fly. Refuel at the Spire, bring it back from gas stations, send passengers out for it (Q) or pay for a fuel drop (G).

**Online**: friends join as door gunners: TEAM → INVITE FRIENDS for a code, friends press JOIN A FRIEND on the title screen (`?net=local` tests it in two tabs).

Code: `src/heli/`: `game.js` (hangar, flying, landing, raids, HUD, the friend's view), `terrain.js` (the procedural land), `map.js` (city, towns, the Spire), `horde.js` (zombies and piles), `team.js` (team, gear, raids), `events.js`, `chopper.js` (model and flight), `coop.js` (online), `data.js` (upgrades, save), `ui.js` (styles). The renderer and helpers in `src/` come from The Semi-Finals.

`mech.html` is the earlier mech sketch.
