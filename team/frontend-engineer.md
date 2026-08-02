# Frontend Engineer

## Mission

Everything the user sees and touches. Quietloom has to feel calm and expensive at
2 AM in a dark room, on a phone held at arm's length by someone who is already tired.

## Owns

| Area | Files |
|---|---|
| Markup & styling | `index.html`, `src/style.css` |
| Screens and sheets | `src/ui/*.js` — `index`, `sheet`, `toast`, `mixer`, `presets-ui`, `timer-ui`, `bedside`, `breathing`, `paywall`, `evidence-ui`, `volume-guide`, `mixes-ui` |
| Canvas scenes | `src/scenes/renderer.js`, `rain.js`, `embers.js`, `waves.js`, `stars.js` |

## Does not own

`src/main.js`, `src/audio/**`, `src/services/**`. You call into them; you do not edit
them. If you need a new engine method or a new service capability, ask.

## Entry point

`main.js` calls exactly this, in this order:

```js
Scenes.attach(document.getElementById('scene-canvas'));   // must be first
initUI({ engine, Scenes });                                // from src/ui/index.js
```

`src/ui/index.js` also exports `closeTopSheet()` and `anyLayerOpen()` — the Android
back button and the banner reconciliation depend on both. `UI-WIRING.md` is the
detailed contract; keep it current when you change the surface.

## Design rules

**Nothing brighter than `#e8edf5`.** Base is `#05070c`. This is a bedroom app.

**Bedside mode is deep red on near-black.** Not white, not blue. Red suppresses
melatonin far less (`research.md` §9). This is a research decision, not a taste one.

**Touch targets ≥ 48 px, transitions 200–300 ms.** Tired hands, no jarring motion.

**Everything must stay legible over the animated canvas** — but the scrim is a
balancing act. It was once heavy enough to bury the scenes almost completely, which
quietly deleted a headline feature. Check both: can you read the text, and can you
see the scene?

**Respect `prefers-reduced-motion` and the `reduceMotion` setting.** Render one still
frame instead. It is also the single biggest battery lever in an all-night app.

**Scenes cap at ~24 fps, DPR ≤ 1.5, and stop the rAF loop entirely** when the document
is hidden, bedside is on, or audio is stopped. The waves scene crest period is 10 s so
it breathes with the ocean layer — keep them in sync.

## The evidence UI is the product

The per-sound evidence card is the differentiator, not a nice-to-have. Badges come
from `src/data/evidence.js` (owned by the Research Lead — read it, do not edit it).
Citation links open through `Native.openUrl`. If the evidence card ever looks like an
afterthought, the positioning collapses.

## Monetization surfaces you touch

- Locked layers open the unlock sheet; they must never toggle instead.
- The paywall's grace rule branches on `Ads.lastRewardedFailure()`, **not**
  `Ads.isAvailable()`. This is deliberate and previously shipped as a bug the other
  way round — see the comment in `paywall.js` and do not "fix" it back.
- Listen for `ads:banner` and pad `#banner-spacer` so a banner never covers controls.
- No ads in bedside or breathing. Ever.

## How to verify

```powershell
npm run dev      # full app in a desktop browser; services no-op, audio still works
npm run build    # must pass
.\scripts\build-apk.ps1
```

Then on a device: open and close every sheet twice and confirm none stack or leak;
check `layer-open` clears from `<html>`; confirm no horizontal overflow
(`scrollWidth === clientWidth`); rotate; and check the first-run experience on a
fresh install, which is the one most likely to be wrong and the one that decides
whether anyone keeps the app.

## Now

1. Empty and error states — no saved mixes, ad unavailable, first launch.
2. Accessibility pass: focus order, screen-reader labels on the icon-only bar buttons.
3. A quiet onboarding moment that explains the citations without a tutorial wall.
