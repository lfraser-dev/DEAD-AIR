# DEAD AIR

A third-person helicopter shooter in a city full of zombies. Plain JavaScript modules and WebGL2, no build step: open `index.html` from any web server (or GitHub Pages).

**Flying** (like Battlefield 2042's helicopters): W / S up and down, A / D turn on the spot, the mouse tilts the helicopter (mouse forward tips the nose down), arrow keys for trackpads. Click: nose gun · right click: rockets · Space: bombs · Shift: afterburner · C: camera. FLIGHT ASSIST (on by default) holds your height and tilt; turn it off in the hangar for full control.

**The hangar**: spend scrap on eight upgrade lines (nose gun, rockets, bombs, armour, engine, rotor, door gunners, cabin) and paint jobs. Every upgrade is built onto the helicopter where you can see it.

**A mission** (10 minutes): land on rooftops under green flares to pick up survivors and fly them to the outpost helipad (which also repairs and rearms you). Zombies climb buildings, spit acid, throw concrete and jump onto your skids. At 8:00 the TITAN comes for the outpost.

Code: `src/heli/` is the game (`game.js` hangar, mission, HUD; `chopper.js` model and flight; `city.js` map; `horde.js` zombies; `data.js` upgrades and save). The renderer and helpers in `src/` come from The Semi-Finals.

`mech.html` is the earlier mech sketch.
