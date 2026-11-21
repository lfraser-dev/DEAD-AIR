// DEAD AIR: the styles for the hangar, HUD and panels.
export const CSS = `
#da-root { position: fixed; inset: 0; pointer-events: none; z-index: 30; font-family: var(--font); color: #fff; }
#da-root .hidden { display: none !important; }
#da-root button { font-family: var(--font); cursor: pointer; pointer-events: auto; }
.da-hangar { position: absolute; inset: 0; pointer-events: none; }
.da-hangar > * { pointer-events: auto; }
.da-title { position: absolute; left: 28px; top: 18px; pointer-events: none !important; }
.da-title b { display: block; font: 900 italic 54px/0.9 var(--font); letter-spacing: .02em; color: #ffcf3a; text-shadow: 0 3px 0 #000, 0 0 24px rgba(255,140,20,.35); }
.da-title span { font: 800 14px var(--font); letter-spacing: .3em; opacity: .85; }
.da-scrap { position: absolute; right: 28px; top: 22px; background: rgba(0,0,0,.6); padding: 8px 14px; font: 900 22px var(--font); letter-spacing: .06em; border-left: 4px solid #ffcf3a; }
.da-scrap small { display: block; font: 700 11px var(--font); letter-spacing: .2em; opacity: .7; }
.da-slots { position: absolute; left: 28px; top: 120px; width: 230px; display: flex; flex-direction: column; gap: 4px; max-height: calc(100vh - 150px); overflow-y: auto; scrollbar-width: thin; padding-right: 4px; }
.da-slot { display: flex; align-items: center; gap: 10px; text-align: left; background: rgba(10,12,14,.72); border: 0; border-left: 4px solid transparent; color: #fff; padding: 5px 10px; flex: none; }
.da-slot i { font-style: normal; width: 22px; text-align: center; font-size: 18px; color: #ffcf3a; }
.da-slot b { display: block; font: 900 15px var(--font); letter-spacing: .08em; }
.da-slot small { font: 700 11px var(--font); letter-spacing: .08em; opacity: .7; }
.da-slot.on { background: rgba(255,207,58,.92); color: #111; border-left-color: #fff; }
.da-slot.on i { color: #111; }
.da-slot em { margin-left: auto; font: 900 11px var(--font); font-style: normal; color: #7dff9a; }
.da-tiers { position: absolute; left: 280px; right: 300px; bottom: 96px; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
.da-tier { width: 200px; text-align: left; background: rgba(10,12,14,.8); border: 2px solid rgba(255,255,255,.12); color: #fff; padding: 10px 12px; }
.da-tier b { display: block; font: 900 17px var(--font); letter-spacing: .05em; }
.da-tier p { margin: 4px 0 8px; font: 600 13px/1.2 var(--font); opacity: .8; min-height: 32px; }
.da-tier span { font: 900 13px var(--font); letter-spacing: .1em; }
.da-tier.eq { border-color: #7dff9a; } .da-tier.eq span { color: #7dff9a; }
.da-tier.buy span { color: #ffcf3a; } .da-tier.lock { opacity: .45; cursor: default; } .da-tier.poor span { color: #ff6a4a; }
.da-tier .sw { display: inline-block; width: 14px; height: 14px; vertical-align: -2px; margin-right: 6px; border: 1px solid rgba(255,255,255,.5); }
.da-stats { position: absolute; right: 28px; top: 110px; width: 250px; background: rgba(10,12,14,.72); padding: 12px 14px; pointer-events: none !important; }
.da-stats h4 { margin: 0 0 8px; font: 900 13px var(--font); letter-spacing: .2em; opacity: .75; }
.da-bar { display: grid; grid-template-columns: 90px 1fr; align-items: center; gap: 8px; margin: 6px 0; font: 800 12px var(--font); letter-spacing: .1em; }
.da-bar i { height: 8px; background: rgba(255,255,255,.12); position: relative; }
.da-bar i::after { content: ''; position: absolute; inset: 0; width: calc(var(--p) * 100%); background: #ffcf3a; transition: width .3s; }
.da-best { margin-top: 10px; font: 700 12px/1.4 var(--font); letter-spacing: .06em; opacity: .75; }
.da-opts { position: absolute; right: 28px; top: 330px; width: 250px; display: flex; flex-direction: column; gap: 5px; }
.da-opt { background: rgba(10,12,14,.72); border: 0; color: #fff; padding: 7px 10px; text-align: left; font: 800 13px var(--font); letter-spacing: .08em; }
.da-opt b { float: right; color: #ffcf3a; }
.da-keys { position: absolute; right: 28px; top: 470px; width: 250px; background: rgba(10,12,14,.6); padding: 10px 12px; font: 700 12px/1.55 var(--font); letter-spacing: .05em; pointer-events: none !important; }
.da-keys kbd { display: inline-block; min-width: 18px; text-align: center; background: #fff; color: #111; font: 900 11px var(--font); padding: 0 4px; margin-right: 4px; }
.da-deploy { position: absolute; right: 28px; bottom: 26px; background: #ffcf3a; color: #111; border: 0; padding: 14px 34px; font: 900 italic 34px var(--font) !important; letter-spacing: .04em; box-shadow: 0 4px 0 #8a6a10; }
.da-deploy:hover { background: #fff; }
.da-back { position: absolute; left: 28px; bottom: 30px; background: rgba(10,12,14,.75); color: #fff; border: 0; padding: 10px 18px; font: 900 16px var(--font); letter-spacing: .1em; }
.da-msg { position: absolute; left: 50%; top: 92px; transform: translateX(-50%); font: 900 20px var(--font); letter-spacing: .12em; color: #7dff9a; text-shadow: 0 2px 0 #000; pointer-events: none !important; transition: opacity .4s; }
.da-hud { position: absolute; inset: 0; pointer-events: none; }
.da-top { position: absolute; top: 14px; left: 50%; transform: translateX(-50%); text-align: center; text-shadow: 0 2px 0 rgba(0,0,0,.8); }
.da-top b { display: block; font: 900 34px var(--font); letter-spacing: .06em; }
.da-top span { font: 800 15px var(--font); letter-spacing: .12em; color: #ffcf3a; }
.da-boss { position: absolute; top: 88px; left: 50%; transform: translateX(-50%); width: 420px; text-align: center; font: 900 14px var(--font); letter-spacing: .3em; color: #ff5a3a; text-shadow: 0 2px 0 #000; }
.da-boss i { display: block; height: 10px; margin-top: 4px; background: rgba(0,0,0,.5); border: 1px solid rgba(255,90,58,.6); position: relative; }
.da-boss i::after { content: ''; position: absolute; inset: 0; width: calc(var(--p) * 100%); background: #ff5a3a; }
.da-left { position: absolute; left: 26px; bottom: 24px; width: 260px; }
.da-meter { margin-top: 7px; font: 900 12px var(--font); letter-spacing: .14em; text-shadow: 0 1px 0 #000; }
.da-meter i { display: block; height: 9px; margin-top: 3px; background: rgba(0,0,0,.55); position: relative; }
.da-meter i::after { content: ''; position: absolute; inset: 0; width: calc(var(--p) * 100%); background: var(--c, #7dff9a); }
.da-meter.hot i::after { background: #ff5a3a; animation: dablink .25s steps(2) infinite; }
.da-right { position: absolute; right: 26px; bottom: 24px; text-align: right; font: 900 18px/1.35 var(--font); letter-spacing: .06em; text-shadow: 0 2px 0 rgba(0,0,0,.8); }
.da-right small { font: 800 11px var(--font); letter-spacing: .18em; opacity: .75; margin-right: 6px; }
.da-flight { position: absolute; left: 50%; bottom: 22px; transform: translateX(-50%); font: 900 15px var(--font); letter-spacing: .14em; text-shadow: 0 2px 0 #000; white-space: nowrap; }
.da-flight span { margin: 0 12px; }
.da-cross { position: absolute; width: 30px; height: 30px; margin: -15px 0 0 -15px; border: 2px solid rgba(255,255,255,.85); border-radius: 50%; box-shadow: 0 0 0 1px rgba(0,0,0,.4); }
.da-cross::after { content: ''; position: absolute; left: 50%; top: 50%; width: 4px; height: 4px; margin: -2px; background: #fff; border-radius: 50%; }
.da-cross.hot { border-color: #ff5a3a; }
.da-hit { position: absolute; width: 22px; height: 22px; margin: -11px 0 0 -11px; opacity: 0; transition: opacity .12s; }
.da-hit::before, .da-hit::after { content: ''; position: absolute; left: 50%; top: -4px; bottom: -4px; width: 2px; margin-left: -1px; background: #fff; transform: rotate(45deg); }
.da-hit::after { transform: rotate(-45deg); }
.da-hit.kill::before, .da-hit.kill::after { background: #ff5a3a; }
.da-mark { position: absolute; transform: translate(-50%, -100%); text-align: center; font: 900 13px var(--font); letter-spacing: .08em; text-shadow: 0 2px 0 #000; white-space: nowrap; }
.da-mark b { display: block; margin: 0 auto 2px; width: 26px; height: 26px; line-height: 26px; font-size: 15px; color: #111; background: var(--c); clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%); }
.da-mark small { display: block; color: #ff5a3a; font-size: 11px; }
.da-mark.off { opacity: .8; }
.da-banner { position: absolute; top: 26%; left: 0; right: 0; text-align: center; text-shadow: 0 3px 0 #000; transition: opacity .3s; }
.da-banner b { display: block; font: 900 italic 56px var(--font); letter-spacing: .03em; color: #fff; }
.da-banner span { font: 800 18px var(--font); letter-spacing: .2em; color: #ffcf3a; }
.da-banner.bad b { color: #ff5a3a; } .da-banner.good b { color: #7dff9a; }
.da-warn { position: absolute; top: 60%; left: 0; right: 0; text-align: center; font: 900 20px var(--font); letter-spacing: .16em; color: #ff5a3a; text-shadow: 0 2px 0 #000; animation: dablink .5s steps(2) infinite; }
.da-feed { position: absolute; right: 26px; top: 130px; text-align: right; font: 900 14px/1.5 var(--font); letter-spacing: .08em; text-shadow: 0 2px 0 #000; }
.da-feed div { animation: dafade 2.4s forwards; } .da-feed .g { color: #7dff9a; } .da-feed .y { color: #ffcf3a; } .da-feed .r { color: #ff5a3a; }
.da-help { position: absolute; left: 50%; transform: translateX(-50%); top: 18px; max-width: min(400px, 40vw); font-size: 11px !important; text-align: center; border-radius: 10px; backdrop-filter: blur(6px); background: rgba(0,0,0,.5); padding: 10px 12px; font: 700 13px/1.6 var(--font); letter-spacing: .05em; transition: opacity 1s; }
.da-help kbd { display: inline-block; min-width: 18px; text-align: center; background: #fff; color: #111; font: 900 11px var(--font); padding: 0 4px; margin-right: 4px; }
.da-dmg { position: absolute; inset: 0; box-shadow: inset 0 0 160px rgba(255,30,10,.9); opacity: 0; }
.da-card { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); background: rgba(10,12,14,.9); padding: 26px 34px; min-width: 380px; text-align: center; pointer-events: auto; border-top: 5px solid #ffcf3a; }
.da-card h2 { margin: 0; font: 900 italic 46px var(--font); letter-spacing: .03em; }
.da-card h2.win { color: #7dff9a; } .da-card h2.lose { color: #ff5a3a; }
.da-card p { font: 700 15px/1.5 var(--font); letter-spacing: .06em; opacity: .9; margin: 10px 0; }
.da-card table { margin: 12px auto; font: 800 15px var(--font); letter-spacing: .08em; border-collapse: collapse; }
.da-card td { padding: 3px 12px; text-align: left; } .da-card td:last-child { text-align: right; color: #ffcf3a; }
.da-card .row { display: flex; gap: 10px; justify-content: center; margin-top: 14px; }
.da-card button { background: #ffcf3a; color: #111; border: 0; padding: 11px 22px; font: 900 18px var(--font); letter-spacing: .08em; }
.da-card button.alt { background: rgba(255,255,255,.14); color: #fff; }
.da-click { position: absolute; left: 50%; top: 58%; transform: translateX(-50%); font: 900 22px var(--font); letter-spacing: .16em; background: rgba(0,0,0,.6); padding: 10px 20px; animation: dablink 1s steps(2) infinite; }
@keyframes dablink { 50% { opacity: .35; } }
@keyframes dafade { 0%, 70% { opacity: 1; } 100% { opacity: 0; } }
@media (max-height: 780px) { .da-slots { top: 96px; gap: 3px; } .da-slot { padding: 4px 10px; } .da-slot b { font-size: 13px; } .da-slot small { font-size: 10px; }
  .da-keys { display: none; } .da-stats { top: 90px; } .da-opts { top: 300px; } .da-tiers { bottom: 84px; } .da-tier p { min-height: 0; font-size: 12px; } .da-back { bottom: 20px; } .da-deploy { bottom: 18px; } }
@media (max-height: 640px) { .da-slots { left: 16px; width: 200px; } .da-slot small, .da-slot i { display: none; } .da-tiers { left: 230px; } }
@media (max-width: 900px) { .da-tiers { left: 20px; right: 20px; bottom: 90px; } .da-tier { width: 150px; } .da-stats, .da-opts, .da-keys { display: none; } .da-title b { font-size: 36px; } }

.da-left .da-meter.fuel i { height: 14px; }
.da-left .da-meter.fuel b { float: right; }
.da-map { position: absolute; right: 22px; top: 18px; width: 190px; height: 190px; background: rgba(8,10,12,.72); border: 2px solid rgba(255,255,255,.18); }
.da-evs { position: absolute; left: 22px; top: 18px; width: 300px; font: 800 13px/1.25 var(--font); letter-spacing: .06em; text-shadow: 0 2px 0 #000; }
.da-evs div { display: flex; align-items: center; gap: 8px; padding: 4px 8px; background: rgba(8,10,12,.55); margin-bottom: 3px; border-left: 4px solid var(--c); }
.da-evs i { font-style: normal; width: 18px; text-align: center; color: var(--c); }
.da-evs span { flex: 1; } .da-evs small { color: #ffcf3a; } .da-evs em { font-style: normal; display: block; color: #ff8a6a; font-size: 11px; }
.da-acts { position: absolute; left: 50%; bottom: 62px; transform: translateX(-50%); display: flex; gap: 10px; pointer-events: auto; }
.da-act { background: rgba(255,207,58,.95); color: #111; border: 0; padding: 10px 16px; font: 900 17px var(--font) !important; letter-spacing: .06em; box-shadow: 0 3px 0 #8a6a10; }
.da-act kbd { display: inline-block; background: #111; color: #ffcf3a; font: 900 13px var(--font); padding: 1px 6px; margin-right: 7px; }
.da-act.alt { background: rgba(20,22,26,.9); color: #fff; box-shadow: 0 3px 0 #000; } .da-act.alt kbd { background: #ffcf3a; color: #111; }
.da-act.red { background: #ff5a3a; }
.da-status { position: absolute; left: 50%; bottom: 120px; transform: translateX(-50%); font: 900 16px var(--font); letter-spacing: .14em; color: #7dff9a; text-shadow: 0 2px 0 #000; white-space: nowrap; }
.da-panel { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(860px, 94vw); max-height: 86vh; overflow: auto; background: rgba(10,12,14,.94); padding: 20px 24px; pointer-events: auto; border-top: 5px solid #ffcf3a; }
.da-panel h2 { margin: 0 0 4px; font: 900 italic 38px var(--font); } .da-panel h3 { margin: 16px 0 8px; font: 900 15px var(--font); letter-spacing: .2em; color: #ffcf3a; }
.da-panel p { margin: 4px 0; font: 600 14px/1.35 var(--font); opacity: .85; }
.da-crew { display: flex; flex-wrap: wrap; gap: 8px; }
.da-cm { width: 190px; background: rgba(255,255,255,.07); padding: 9px 11px; border-left: 4px solid var(--c); }
.da-cm b { display: block; font: 900 17px var(--font); letter-spacing: .05em; } .da-cm small { font: 900 12px var(--font); letter-spacing: .14em; color: var(--c); }
.da-cm p { font-size: 12px; min-height: 30px; } .da-cm button { margin-top: 6px; }
.da-panel button { background: #ffcf3a; color: #111; border: 0; padding: 7px 14px; font: 900 14px var(--font); letter-spacing: .08em; }
.da-panel button.alt { background: rgba(255,255,255,.14); color: #fff; } .da-panel button:disabled { opacity: .4; cursor: default; }
.da-code { display: inline-block; font: 900 44px var(--font); letter-spacing: .25em; background: #000; padding: 4px 16px; color: #7dff9a; margin: 6px 0; }
.da-panel .close { position: absolute; right: 14px; top: 14px; }
.da-join { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: auto; background: rgba(0,0,0,.6); }
.da-join .da-card { position: static; transform: none; }
.da-join input { font: 900 40px var(--font); letter-spacing: .3em; width: 260px; text-align: center; text-transform: uppercase; padding: 6px; border: 0; margin: 10px 0; }
.da-spec { position: absolute; transform: translate(-50%, -100%); font: 900 11px var(--font); color: #ff5a3a; text-shadow: 0 1px 0 #000; letter-spacing: .1em; white-space: nowrap; }
.da-gunner .da-cross { left: 50% !important; top: 50% !important; }
.da-teambtn { position: absolute; right: 300px; bottom: 30px; background: rgba(10,12,14,.85); color: #fff; border: 2px solid #ffcf3a; padding: 12px 22px; font: 900 22px var(--font) !important; letter-spacing: .06em; }
.da-teambtn:hover { background: #ffcf3a; color: #111; }
.da-tbtn { position: absolute; right: 22px; top: 216px; background: rgba(10,12,14,.8); color: #fff; border: 2px solid rgba(255,255,255,.25); padding: 6px 12px; font: 900 14px var(--font) !important; letter-spacing: .1em; pointer-events: auto; }
.da-tbtn kbd { background: #ffcf3a; color: #111; padding: 0 5px; margin-right: 5px; font: 900 12px var(--font); }
.da-gunner .da-tbtn { display: none; }

/* ---- polish (glass panels, rounded bars, glowing buttons) ---- */
.da-left { background: linear-gradient(180deg, rgba(10,12,16,.55), rgba(10,12,16,.35)); padding: 10px 14px 12px; border-radius: 10px; backdrop-filter: blur(6px); border: 1px solid rgba(255,255,255,.08); }
.da-meter i { border-radius: 5px; overflow: hidden; } .da-meter i::after { border-radius: 5px; box-shadow: 0 0 12px var(--c, #7dff9a); }
.da-right { background: linear-gradient(180deg, rgba(10,12,16,.55), rgba(10,12,16,.35)); padding: 10px 14px; border-radius: 10px; backdrop-filter: blur(6px); border: 1px solid rgba(255,255,255,.08); }
.da-evs div { border-radius: 0 8px 8px 0; backdrop-filter: blur(6px); background: rgba(8,10,12,.5); }
.da-delta { display: flex; flex-wrap: wrap; gap: 4px; margin: 4px 0; } .da-delta em { font: 800 10px var(--font); font-style: normal; padding: 2px 6px; border-radius: 4px; letter-spacing: .04em; } .da-delta em.up { background: rgba(80,220,120,.22); color: #7dff9a; } .da-delta em.dn { background: rgba(255,90,58,.2); color: #ff8a6a; }
.da-tier.nofit { opacity: .55; } .da-tier small.warn { color: #ffcf3a; } .da-slot.off { opacity: .45; }
.da-bigmap { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(78vh, 620px); height: min(78vh, 620px); border-radius: 14px; border: 2px solid rgba(255,255,255,.25); box-shadow: 0 10px 40px rgba(0,0,0,.6); z-index: 5; }
.da-map { border-radius: 12px; backdrop-filter: blur(6px); box-shadow: 0 6px 24px rgba(0,0,0,.4); }
.da-act { border-radius: 8px; font-size: 15px !important; padding: 9px 12px; white-space: nowrap; box-shadow: 0 4px 0 #8a6a10, 0 0 24px rgba(255,207,58,.45); animation: dapulse 1.4s ease-in-out infinite; }
.da-act.alt { animation: none; box-shadow: 0 4px 0 #000; backdrop-filter: blur(6px); }
.da-act:hover { transform: translateY(-2px); filter: brightness(1.1); }
.da-acts { flex-wrap: wrap; justify-content: center; max-width: min(760px, 70vw); gap: 7px; }
@keyframes dapulse { 50% { box-shadow: 0 4px 0 #8a6a10, 0 0 40px rgba(255,207,58,.85); } }
.da-cross { border-width: 2px; box-shadow: 0 0 0 1px rgba(0,0,0,.5), 0 0 10px rgba(255,255,255,.25); }
.da-banner b { background: linear-gradient(180deg, #fff, #ffd98a); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 3px 0 #000); }
.da-banner.bad b { background: linear-gradient(180deg, #ffb09a, #ff4a2a); -webkit-background-clip: text; background-clip: text; }
.da-banner.good b { background: linear-gradient(180deg, #d8ffe0, #4ee07a); -webkit-background-clip: text; background-clip: text; }
.da-card, .da-panel { border-radius: 14px; backdrop-filter: blur(10px); box-shadow: 0 20px 60px rgba(0,0,0,.55); }
.da-card button, .da-panel button { border-radius: 8px; }
.da-slot, .da-opt, .da-tier, .da-stats { border-radius: 8px; backdrop-filter: blur(6px); }
.da-tier { transition: transform .12s, border-color .12s; } .da-tier:hover { transform: translateY(-3px); border-color: rgba(255,207,58,.6); }
.da-deploy, .da-teambtn, .da-back { border-radius: 10px; }
.da-dmg { box-shadow: inset 0 0 200px rgba(255,30,10,.95); }
.da-hud::after { content: ''; position: absolute; inset: 0; pointer-events: none;  z-index: -1; background: radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,.35)); }
.da-white { position: absolute; inset: 0; background: #fff8e8; opacity: 0; pointer-events: none; }
.da-slots { max-height: calc(100vh - 190px); overflow-y: auto; scrollbar-width: thin; padding-right: 4px; }
.da-tier { width: 172px; }
.da-tiers { max-height: 46vh; overflow-y: auto; }
.da-hpb { height: 6px; background: rgba(255,255,255,.12); border-radius: 3px; margin: 5px 0 3px; overflow: hidden; } .da-hpb i { display: block; height: 100%; background: #7dff9a; }
.da-btns { display: flex; flex-wrap: wrap; gap: 4px; } .da-btns button { padding: 4px 7px !important; font-size: 11px !important; }
.da-cm { width: 210px; }
.da-recruit { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; } .da-recruit input { font: 900 18px var(--font); width: 150px; padding: 6px 8px; border: 0; border-radius: 6px; text-transform: uppercase; }
.da-roles { font-size: 12px !important; line-height: 1.5 !important; }
.da-shop { display: flex; flex-wrap: wrap; gap: 6px; } .da-shop button { width: 150px; text-align: left; } .da-shop b { display: block; font-size: 14px; } .da-shop small { display: block; font: 600 11px var(--font); opacity: .75; min-height: 26px; } .da-shop span { color: #ffcf3a; }
.da-raid { position: absolute; right: 22px; top: 262px; width: 250px; background: rgba(8,10,12,.62); backdrop-filter: blur(6px); border-radius: 10px; padding: 10px 12px; font: 800 12px/1.35 var(--font); letter-spacing: .05em; pointer-events: auto; border-left: 4px solid #ffcf3a; }
.da-raid h5 { margin: 0 0 6px; font: 900 14px var(--font); letter-spacing: .1em; color: #ffcf3a; }
.da-floors { display: flex; flex-direction: column-reverse; gap: 2px; margin-bottom: 6px; max-height: 150px; overflow: hidden; }
.da-floors div { height: 6px; border-radius: 2px; background: rgba(255,255,255,.14); position: relative; }
.da-floors div.done { background: rgba(125,255,154,.35); } .da-floors div.here { background: #ffcf3a; box-shadow: 0 0 8px #ffcf3a; }
.da-floors div.hot::after { content: ''; position: absolute; right: 2px; top: 1px; width: 4px; height: 4px; border-radius: 50%; background: #ff5a3a; }
.da-mem { display: grid; grid-template-columns: 70px 1fr; gap: 6px; align-items: center; margin: 2px 0; } .da-mem i { height: 5px; border-radius: 3px; background: rgba(255,255,255,.12); overflow: hidden; } .da-mem i b { display: block; height: 100%; background: #7dff9a; }
.da-raid .log { margin-top: 6px; font: 700 11px/1.35 var(--font); opacity: .85; }
.da-raid .row2 { display: flex; gap: 5px; margin-top: 7px; } .da-raid button { flex: 1; background: rgba(255,255,255,.12); color: #fff; border: 0; border-radius: 6px; padding: 5px 4px; font: 900 11px var(--font); letter-spacing: .05em; } .da-raid button.on { background: #ffcf3a; color: #111; }
.da-slot u { display: flex; gap: 3px; margin-top: 3px; text-decoration: none; }
.da-slot u q { width: 14px; height: 4px; border-radius: 2px; background: rgba(255,255,255,.14); quotes: none; }
.da-slot u q::before, .da-slot u q::after { content: none; }
.da-slot u q.o { background: color-mix(in srgb, var(--r) 45%, transparent); }
.da-slot u q.f { background: var(--r); box-shadow: 0 0 6px var(--r); }
.da-slot.on u q { background: rgba(0,0,0,.18); } .da-slot.on u q.o { background: rgba(0,0,0,.4); } .da-slot.on u q.f { background: #111; box-shadow: none; }
.da-tier { position: relative; overflow: hidden; border-top: 3px solid var(--r, #9aa3ad); background: linear-gradient(180deg, color-mix(in srgb, var(--r, #9aa3ad) 16%, rgba(10,12,14,.85)), rgba(10,12,14,.86) 55%); }
.da-tier .tn { display: flex; justify-content: space-between; align-items: center; font: 900 11px var(--font); letter-spacing: .16em; color: var(--r, #9aa3ad); margin-bottom: 2px; }
.da-tier .tn kbd { font: 900 10px var(--font); letter-spacing: .05em; color: #111; background: var(--r, #ccc); padding: 1px 5px; border-radius: 3px; }
.da-tier.eq { box-shadow: 0 0 0 1px #7dff9a inset, 0 0 18px rgba(125,255,154,.18); }
.da-tier.lock { opacity: .5; filter: saturate(.5); }
.da-chips { display: flex; flex-wrap: wrap; gap: 4px; margin: -2px 0 8px; }
.da-chips i { font: 800 10.5px var(--font); font-style: normal; letter-spacing: .05em; padding: 2px 6px; border-radius: 3px; background: rgba(125,255,154,.14); color: #7dff9a; }
.da-chips i.dn { background: rgba(255,106,74,.14); color: #ff8a6a; }
.da-tier:not(.lock):hover::after { content: ''; position: absolute; inset: 0; background: linear-gradient(110deg, transparent 30%, rgba(255,255,255,.08) 50%, transparent 70%); animation: da-shine .8s ease-out; pointer-events: none; }
@keyframes da-shine { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
.da-hpick { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.da-hpick button { background: rgba(255,255,255,.12); color: #ffcf3a; border: 0; width: 26px; height: 24px; font: 900 13px var(--font); cursor: pointer; border-radius: 3px; }
.da-hpick button:hover { background: #ffcf3a; color: #111; }
.da-hpick small { flex-basis: 100%; font: 700 10px var(--font); letter-spacing: .08em; opacity: .6; }
.da-tiers { max-height: 52vh; }
.da-tiers { scrollbar-width: auto; scrollbar-color: #ffcf3a rgba(0,0,0,.3); }
.da-tiers.compact { gap: 6px; }
.da-tiers.compact .da-tier { width: 132px; padding: 8px 10px; }
.da-tiers.compact .da-tier.eq { width: 210px; }
.da-tiers.compact .da-tier p { min-height: 0; font-size: 11px; margin: 4px 0 6px; }
.da-tiers.compact .da-tier small { font-size: 10px; }
@media (max-width: 1150px) { .da-tiers { left: 230px; right: 250px; } .da-tiers.compact .da-tier { width: 118px; } .da-tiers.compact .da-tier.eq { width: 170px; } }
@media (max-width: 900px) { .da-tiers { left: 20px; right: 20px; } }
`;
