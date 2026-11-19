# DEAD AIR

A third-person helicopter shooter in an open world full of zombies. Plain JavaScript modules and WebGL2, no build step: open `index.html` from any web server (or GitHub Pages).

**Flying**: three styles, picked in the hangar. EASY (the default): the mouse steers (left/right turns, forward/back flies forward/back), A / D slide sideways, W / S up and down, it hovers when you let go, crashes hurt less and the gun helps you aim. ASSIST and PRO fly like Battlefield 2042 (mouse tilts, A / D turn; PRO has no levelling). Click: nose gun · right click: rockets · Space: bombs · Shift: afterburner · C: camera.

**The world**: a city (towers, offices, suburbs, an industrial east side) and countryside, with four army bases (FOBs) and a fuel pad on a downtown tower. Scenarios keep popping up: RESCUE (survivors on a roof under a green flare), CONVOY (escort lorries to a base), NEST (blow it up), SUPPLY CRATE (hook it on and carry it to a base), SIEGE (a base under attack) and the TITAN. No timer: fly as long as your fuel lasts.

**Landing**: when you land somewhere you can do something, the mouse is let go and buttons appear (or press the keys): E pick up / drop off / hook or drop a crate, H hangar, T team, Q send your passengers to find fuel (not all of them come back), G pay for a fuel drop. Bases refuel, repair and rearm you.

**Fuel**: runs down as you fly (bigger tanks in the hangar). Run dry and the rotor windmills you down slowly.

**Team**: survivors you rescue sometimes volunteer as crew (gunner, mechanic, medic, scavenger, lookout), each with a bonus. Friends can join online as door gunners: the pilot opens TEAM → INVITE FRIENDS for a code, friends press JOIN A FRIEND on the title screen (`?net=local` tests it in two tabs).

Code: `src/heli/`: `game.js` (hangar, flying, landing actions, HUD, the friend's view), `chopper.js` (model and flight), `map.js` (the world), `horde.js` (zombies), `events.js` (scenarios), `crew.js`, `coop.js` (online), `data.js` (upgrades, save), `ui.js` (styles). The renderer and helpers in `src/` come from The Semi-Finals.

`mech.html` is the earlier mech sketch.
