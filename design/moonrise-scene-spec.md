# Moonrise — a fifth living scene, and the design moves around it

**Author:** Product Designer
**For:** Software Team Lead (sizing + assignment), CEO (two contract notes below), Research Lead (one copy approval)
**Status:** Proposal. Nothing here is merged; an interactive prototype accompanies this spec.

The founder asked for a night main screen — sky, moon, gentle animation, and sheep that
appear and jump from time to time — framed as a suggestion, with the goals: dark, easy
to use, attracts installs, converts to paid.

The short answer: **yes, and the sheep are the best part** — but not for the reason you'd
guess. There is a well-known 2002 Oxford study of people with insomnia: the group told to
distract themselves with engaging, pleasant imagery before bed reported falling asleep
faster than a no-instruction group, and less-distressing pre-sleep thoughts besides; a
general-distraction group showed no such advantage; counting sheep itself was never one
of the tested conditions. That lets Quietloom do the most Quietloom thing possible: ship
the calm scene, let a sheep amble through occasionally as a wink, and put an evidence
card on it that cites the research pointing away from counting sheep. No competitor can
copy that joke, because no competitor cites anything.

---

## 1. What the research says (standing-duty findings)

**Category.** Calm's identity is scene-switching (mountain lake → sunset coast); Endel's
is generative visuals; BetterSleep's is an onboarding quiz feeding a projected-improvement
graph. Users consistently call out "minimalist but unique, with moving patterns" as what
they value. Our living scenes are already the right strategy — the gap is that none of
them is *unmistakably ours* in a single screenshot. Rain, embers, waves and stars are
beautiful but generic nouns. A moonrise with a lunar-accurate moon and a rare sheep is a
screenshot nobody else has.

**Money.** The current model (rewarded night pass + $4.99 lifetime) is the right primary
engine per `BUSINESS.md`, and the subscription tier arrives in the day-11–18 window.
The conversion research that transfers to us now:

- *Value must be visible before the ask.* The highest-converting paywalls fire right
  after the "aha" moment and show what you get, not a text list. Our unlock sheet is
  currently text-only — it names the locked layers but never *shows* anything.
- *Health/wellness leads all categories in download-to-paid conversion* (median ~2.9%,
  top quartile 6%+), and hard-locked content selects for higher-intent payers. We don't
  need a hard paywall — the rewarded path is our engine — but every additional
  *desirable, visible* locked thing is another rewarded view per night.
- *Trial-format screens win ~65% of A/B tests vs. visual-only layouts.* When the
  subscription tier lands, the sheet must present it without a redesign — the layout
  below reserves that slot now.

**The sheep evidence.** Harvey & Payne (2002), *Behaviour Research and Therapy* 40(3),
267–277: in a 41-person study of people with insomnia, the group instructed to distract
themselves with engaging, pleasant imagery reported shorter sleep-onset latency than the
no-instruction group, and rated their pre-sleep thoughts and worries as less distressing.
The group instructed to use general distraction showed no such advantage. Counting sheep
was never itself a tested condition — the "counting is too boring, imagery is absorbing"
read is the mechanism the paper argues for, not a head-to-head sheep-counting result.
PubMed: <https://pubmed.ncbi.nlm.nih.gov/11863237/>

Moonrise is a nod to that finding, not a reproduction of it: the study's imagery was
self-generated, in the dark, eyes closed — not a scene watched on a screen. Nothing we
publish may imply that looking at a screen before bed aids sleep; the positioning is the
wink and the citation, not a claim of equivalence.

---

## 2. The scene: **Moonrise**

Scene id `moonrise`, joining `rain | embers | waves | stars`. One word, like its siblings.

### Composition (back to front)

1. **Sky** — vertical gradient, deep indigo to near-black: top `#0a1020`, bottom
   `#03040a`. Cached linear gradient, rebuilt on resize only (same pattern as `stars.js`).
2. **Starfield** — reuse the `stars.js` field mechanic at roughly half density and
   two-thirds alpha. The moon owns this sky; stars support it.
3. **The moon** — the centerpiece, and it is *honest*:
   - **Real lunar phase**, computed from the date (synodic approximation from a known
     new-moon epoch; ±1 day accuracy is fine). Zero assets, zero cost, and it makes the
     scene different every week — a quiet retention hook and a press-able detail
     ("the moon in the app is the moon outside your window").
   - **Position tracks the clock.** The moon rises along a shallow arc through the
     evening and sits low by early morning. Motion is imperceptible in real time —
     you notice it *between* nights, not during one.
   - Disc `#dfe4ee` (under the `#e8edf5` ceiling), soft edge, halo as a cached radial
     gradient sprite at ~12% alpha (the `tintSprite` pattern from `stars.js`).
4. **Clouds** — two or three long translucent bands, cached gradient sprites drifting at
   different speeds, occasionally crossing the moon (which dims the halo — a free,
   organic "event" with no event system).
5. **Meadow** — two overlapping hill silhouettes at the bottom, `#060910` over
   `#04060a`. The crest of the front hill is the sheep's path. A handful of static
   grass-blade strokes on the crest, nothing more.

**Accent tokens** (consumed by `applyAccent`): accent `#a9b9dd` (moon-silver),
accent-soft `rgba(169,185,221,0.16)`, top `#0a1020`, bottom `#03040a`.

### The sheep — rules of restraint

The sheep is a *delighter*, and delighters die from repetition. The design is mostly
about what it does **not** do:

- **Rare.** One sheep at a time, appearing on a random interval of **60–120 seconds**.
  You should be able to use the app for a minute and never see one. The person who
  catches one feels like they saw something.
- **Small and dim.** ~28px at phone scale, soft pale fleece (~`#c9d1df` at ≤85% alpha),
  darker head and legs. Legible at low brightness, never bright enough to light the room.
- **One behavior, done well.** It walks in along the hill crest with a gentle gait,
  makes **one unhurried arc-hop** over a low stone on the crest, walks off the other
  side. On screen ~10 seconds. Direction random. No sound — crickets and wind already
  own the audio, and a sound effect would violate the synthesis-only identity.
- **Suppressed where it must be.** No sheep in bedside mode (that surface is for
  sleeping, and the red multiply pass would tint the fleece anyway), none under
  reduced-motion (the scene renders a still frame there — `drawStill` draws sky, moon,
  clouds, meadow; never a sheep), none while the sheet stack is open if cheap to detect.
- **We do not count them.** No counter, no streak, no achievement. The restraint *is*
  the joke, and the evidence card lands it.

### Performance envelope

Everything fits the existing renderer contract with no renderer changes: 24fps cap,
DPR ≤1.5, particle counts scaled by `env.area`, `init/resize` rebuild caches,
`drawStill` supported. Budget target: **at or below the `stars` scene** (fewer stars, a
few cached sprites, one animated sprite at most). The sheep is a polyline-and-arcs
drawing, not an image asset — zero bytes added to the APK, consistent with the
zero-assets identity.

### Contract notes (CEO visibility)

- Adding `moonrise` to the `SCENES` map and the preset data is **additive** to the
  frozen `Scenes.setScene(...)` contract. Per the freeze rule, adding is fine; nothing
  existing changes. Flagging it anyway because the renderer's doc comment enumerates
  the scene names.
- The evidence card below is a user-facing claim and **requires Research Lead
  approval** before it ships. Copy is drafted to be conservative.

---

## 3. The evidence card (approved by the Research Lead, 2026-08-02 — ships verbatim)

Entry in `src/data/evidence.js`, id `moonrise`, surfaced by tapping the moon (same
info-dot affordance as layers):

> **Moonrise** — badge **Emerging**
>
> *Claim:* A sheep crosses now and then. We never ask you to count it — counting is
> the folklore; imagery is the part that was actually tested.
>
> *Detail:* Forty-one people with insomnia were each given one of three instructions
> for the night: distract yourself using imagery, distract yourself generally, or no
> instruction at all. The imagery group — told to picture a situation they found
> interesting and engaging, but also pleasant and relaxing — reported shorter
> sleep-onset latency than the no-instruction group, and rated their pre-sleep
> thoughts and worries as less distressing. General distraction showed no such
> advantage. Two honest limits: 'counting sheep' was never one of the conditions,
> and the imagery was generated in the participant's own head in the dark, not
> watched on a screen. Moonrise is a nod to that finding, not a reproduction of it.
> One small study, a single night, not widely replicated.
>
> *Sources:* Harvey & Payne 2002, Behaviour Research and Therapy 40(3):267–277 —
> <https://pubmed.ncbi.nlm.nih.gov/11863237/> · Cognitive and Affective Control in
> Insomnia, Front Psychol 2011 (independent description of the same study) —
> <https://www.frontiersin.org/articles/10.3389/fpsyg.2011.00349/full>

We show a sheep while citing the research that points away from counting — and we say
plainly that counting was never even the tested condition. That's the honest version of
the joke, and it's still a tweet, a store caption, and a Hacker News comment all at once.

---

## 4. Monetization tie-ins (why this converts, concretely)

Scenes are free today (`Entitlements` gates sounds only) and Moonrise should stay
free-to-see — it is the shop window. The conversion work happens around it:

1. **"Moonlit Meadow" preset** — Moonrise scene + **crickets + wind** (both premium)
   over free brown noise. It becomes the most attractive preset in the row, it is
   *visible* to free users, and tapping it opens the unlock sheet with a reason that
   sells itself. This feeds the rewarded funnel exactly the way `BUSINESS.md`
   (days 19–24) calls for: every desirable locked thing is one more nightly rewarded
   view. Free tier stays genuinely useful — nothing free is taken away.
2. **Unlock sheet: show, don't list.** Add a value strip above the two options — the
   locked layers as small chips with their evidence badges (Thunder ·M·, Fire ·S·,
   Crickets ·M·, Wind ·M·, Binaural ·E·, Deep Pulse ·E·), with the chips for whatever
   triggered the sheet gently highlighted. The research is unambiguous that showing
   value beats describing it. Layout reserves a third option slot so the future
   subscription drops in without a redesign.
3. **Store assets.** Moonrise (moon + sheep mid-hop) becomes the **feature graphic**
   and screenshot #1, caption: *"The sheep is a wink. The citation is real."* It reads
   at thumbnail size, it is unmistakably ours, and it makes the evidence story visual
   instead of textual. This caption ruling is binding on any marketing variant of the
   line, Growth included — no version may claim the scene "beat" counting sheep in a
   study. (Charter "Now" item 1 — store screenshots — this gives that work its hero.)
4. **First launch lands on Moonrise** at dusk with one line of copy: *"Every sound
   generated live. Every claim cites its study."* That is the onboarding moment from
   charter "Now" item 3, without a tutorial.

Explicitly *not* proposed: gating the scene itself, a sheep counter, sheep sounds, or
any ad surface anywhere near this screen. Bedside mode is untouched.

---

## 5. Verification (how I'll judge the built result)

Per the charter — on a device, in the dark, by someone tired:

- Real phone at minimum brightness: moon legible, sheep legible but not bright,
  nothing anywhere above `#e8edf5`.
- Battery: overnight soak with Moonrise active must match the `stars` scene within
  noise. The sheep must not hold a wake lock on the render loop between appearances —
  between events the frame cost must equal the sheep-less scene.
- Reduced motion: still frame, no sheep, no drift.
- Bedside mode: red multiply produces a coherent red-on-black sky; no sheep events.
- Smallest supported screen + large-font setting: hill crest and bottom bar don't
  collide; evidence card scrolls.
- Screenshot grid check against the other four scenes: same family, same weight.

## 6. Sizing hints for the Team Lead

Independent, in value order: **(a)** the scene module (`src/scenes/moonrise.js` +
registration + accent tokens) — senior frontend, the moon/phase/clock mechanics have
real judgement in them; **(b)** the sheep event system inside the scene — same owner,
same file; **(c)** the evidence entry + preset data — junior-sized once copy is
approved; **(d)** the unlock-sheet value strip — small but touches a monetization
surface, senior review warranted. The prototype accompanying this spec demonstrates
all of (a)–(c) visually.

## 7. As-built record (2026-08-02, end of implementation run)

Implemented in the working tree (uncommitted, founder decides on commit). Sign-offs:
Research Lead (copy, incl. two amendments during build), Software Team Lead
(engineering, waves 2–3), QA & Verification (PASS, hash-pinned twice), Product
Designer (sign-off YES after a blocked first review and a fix wave).

**Deltas from this spec as designed:**

- **Badge is Emerging, not Traditional**; title "Moonrise"; all copy per the Research
  Lead's ruling in §3. The "~20 minutes" figure is permanently struck.
- **Preset is named "Moonrise"** (not "Moonlit Meadow"), third in the row after the two
  free presets. Note copy amended by the Research Lead ("…interesting enough to hold
  your attention…").
- **The moon-tap dot is "on the moon or not at all."** The designed idea of a
  relocated dot was rejected in review. In practice the mixer chrome occludes the moon
  at phone widths, so the canvas dot is effectively a tablet/desktop-width delighter.
- **Primary evidence surface is the preset note card**: a standard info-dot sits
  top-right of the card, and a scene-keyed fallback card (same dot, subtractive
  RL-approved blurb, no unlock line) renders when moonrise is active with no preset —
  closing the cold-boot gap. Precedence is explicit: a real preset note always wins.
- **Daytime (06:00–18:00)**: the moon rests on the skyline, mostly behind the hills —
  "not risen yet." Continuous at both boundaries.
- **Clouds**: full-width bands ≥8.5:1 with linear end/edge fades (the designed/prototyped
  ellipse mask read as lens flare and was rejected). Moon is ≥20% veiled ~half the
  cycle as one episodic crossing — accepted as weather; capture store assets at a
  clean-moon moment.
- **Terminator** softened via blurred lit-region clipped to the disc, built per
  resize/date change.
- Measured: moonrise costs *less* per frame than the stars scene (flushed mean 10.06 ms
  vs 27.82 ms at 390×844); brightness maxima (223,228,238) vs ceiling (232,237,245);
  sheep cadence verified 60–120 s, one hop, never two.

**Backlog (decided, not yet built):** unlock-sheet value strip + reserved subscription
slot (wave-2 order, Senior, sole owner of paywall.js + style.css); fallback-card copy
polish (mention the moon/phase — RL note); drop the unused `veil` field from
`moonTarget()`; device verification (safe areas, real low-brightness legibility,
overnight battery soak) before release; store screenshots per §4.

## Sources

- Harvey & Payne 2002 — [PubMed](https://pubmed.ncbi.nlm.nih.gov/11863237/) · [ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0005796701000122) (paywalled, abstract only)
- [Cognitive and Affective Control in Insomnia, Front Psychol 2011](https://www.frontiersin.org/articles/10.3389/fpsyg.2011.00349/full) — independent description of the same study
- [RevenueCat, State of Subscription Apps](https://www.revenuecat.com/state-of-subscription-apps) (health/fitness conversion, trial timing)
- [Adapty — high-performing paywalls 2026](https://adapty.io/blog/high-performing-paywall-2026/) · [iOS paywall design](https://adapty.io/blog/how-to-design-ios-paywall/)
- [Superwall — winning paywall strategies](https://superwall.com/blog/superwall-best-practices-winning-paywall-strategies-and-experiments-to)
- [ScreensDesign teardowns — Calm](https://screensdesign.com/showcase/calm) · [BetterSleep](https://screensdesign.com/showcase/bettersleep-relax-and-sleep) · [Endel](https://screensdesign.com/showcase/endel-focus-sleep-sounds)
- [Frontiers in Psychiatry — sleep app user needs scoping review](https://www.frontiersin.org/journals/psychiatry/articles/10.3389/fpsyt.2022.1037927/full)
