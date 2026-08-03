# Task: SIMPLER — less to think about, and worth subscribing to

**Opened by:** the founder, 2026-08-03
**Owner:** CEO → Product Designer, Growth Lead, Research Lead
**Status:** dispatched. Research wave running. **No code and no doc edits in this wave.**

---

## The report

> "do a research on how to make the ui ux simpler and not overwhelming, plus I want it to be money
> making, so it should attract the user to be a subscriber"

Two halves, one problem. An app that overwhelms someone at 23:40 does not get a second night, and a
user who does not come back never subscribes. Do not treat these as separate workstreams that meet
at the end.

## What the founder just decided, and what is still open

**Decided.** `team/ceo.md` § Now carried an open question — retention work or the subscription tier.
`BUSINESS.md` days 11–18 sketched a subscription and it was never ruled on. The founder has now
ruled: **there will be a subscription.** Nobody needs to relitigate that.

**Still open, and this is the task.** Its shape, its price, what recurs, when we ask, and what
happens to the one-time product that already exists. `quietloom_premium_forever` ($4.99, managed
product, `Billing.PRODUCT_ID`) is in a **frozen contract** that `src/ui/sheets/PaywallSheet.tsx`
branches on. Nothing in a proposal may assume it silently disappears.

## What the CEO wants out of this

1. **Concrete proposals, not summaries.** The Product Designer's charter already says it: *"Their
   paywall converts better because the value is demonstrated before the ask, and here is how ours
   would change"* is useful; a reading list is not. Every proposal names the screen, the change and
   the reason.
2. **A subscription proposal that says what recurs.** A recurring charge needs recurring value. If
   the honest answer is "today, nothing recurs — here is what would have to exist first", that is a
   finding and I want it stated plainly, not papered over with a price.
3. **A simplification proposal that survives contact with the positioning.** The evidence card *is*
   the product. Simplifying it into a footnote solves this task by destroying the company.

## The CEO's standing leads

Not conclusions. Start here, and say so plainly if the evidence goes elsewhere.

**Lead 1 — count the choices on first run, then count them again.** A tired person opening this app
meets a preset row, eleven layer cards with sliders and padlocks, a master row, a timer, bedside,
breathing, mixes and an evidence card. We ask someone who wants to sleep to become a sound engineer.
My prior — and it is a prior, argue with it — is that the win is a strong default plus progressive
disclosure, **not** deleting features. Nothing here was built for no reason.

**Lead 2 — the padlocks are the overwhelm and the paywall at the same time.** Standing decision 4
says the four best-evidenced layers are free forever, and QA's checklist says first run must open on
a free preset, *not a wall of padlocks*. Whether that is what actually happens today is a thing to
go and look at, not assume. How locked content is *shown* is simultaneously the simplicity question
and the conversion question, and it is the highest-leverage single surface in the app.

**Lead 3 — value before the ask, and here the value takes a night.** The paywall research field is
consistent that conversion follows demonstrated value. What "demonstrated" means for a sleep app is
not a screenshot — it is waking up having slept. So the honest ask moment is plausibly session two
or day two, not minute one. Converge on a *specific* moment and defend it; "somewhere in onboarding"
is not an answer.

**Lead 4 — nothing here is measured and cannot be.** Zero users, zero analytics, zero store
presence. Every number in this task is either from a published source or is inference. Same rule as
FASTER: mark a claim `(reasoned, not measured)` or cite it. We have shipped a confident wrong answer
before, and a pricing decision is far more expensive to reverse than a render loop.

**Lead 5 — do not buy conversion by eroding a standing decision.** All six are easy to trade for a
short-term lift, and all six would be wrong. Specifically, and non-negotiably in this wave: no ads
on sleep surfaces; the grace rule stands; rain, ocean, pink and brown stay free forever and the
default preset stays free; and **paywall copy is a claim** — it goes past the Research Lead like
every other claim. If a proposal needs one of these to move, it comes to me as an argument, not as a
mockup that quietly assumes it.

## Rules for this task

- **Research and proposals only. No code. No edits to `BUSINESS.md`, `README.md`, `research.md`,
  `evidence.ts` or anything under `src/`.** Everything lands in your log entry in this file and I
  route it afterwards. This is deliberate: I want the proposals judged side by side before any of
  them becomes a fact in a document.
- **Cite or mark.** A source gets a URL. An inference gets `(reasoned, not measured)`.
- **Install and look at the competition** where it is possible from here — Calm, BetterSleep, Endel,
  Portal, Sonora. Sonora is closest to our positioning. What is *actually* on their first screen
  beats anyone's memory of it.
- **Disagree in writing.** If the Designer's simplification and the Growth Lead's conversion plan
  pull in opposite directions, say so in your entry rather than splitting the difference. That
  disagreement is the most useful thing this wave can produce and I will rule on it.

---

## How to log

**Every person logs when they start and when they stop, and what they are about to do or what they
did.** That is the founder's standing instruction and it is not optional.

**Append only** — never open this file with an editor and never rewrite it:

```powershell
$entry = @'

### <ROLE> — <started|finished>  <!-- timestamp -->
...your lines...
'@
Add-Content -Path tasks/simpler.md -Value $entry -Encoding utf8
```

Get a real timestamp with `Get-Date -Format 'HH:mm:ss'`. If `Add-Content` fails because another
role holds the file, wait a second and try again.

---

## Assignments

| Role | Scope | Files it may touch |
|---|---|---|
| Product Designer | Simplification: first run, information density, progressive disclosure, the visual shape of the paywall and the padlock. Before/after proposals against the real screens | none — spec only, into this log |
| Growth Lead | The subscription: shape, price, what recurs, trial/intro design, the ask moment, what the existing $4.99 buyer gets, and the metrics that would prove any of it. Opus-grade decisions — this is pricing, not copy | none — proposal only, into this log |
| Research Lead | Claim veto over both proposals, and the question the other two cannot answer for themselves: does simplification threaten the evidence positioning, and where exactly | none — into this log |

Not in this wave: the Software Team Lead sizes nothing until proposals exist, and no engineer
touches a screen. CEO holds the ruling and the routing.

---

## Work log

<!-- APPEND BELOW THIS LINE. Oldest first. Never edit an entry that is not yours. -->

### CEO — opened 21:14:11
Did: read the founder's instruction and recorded that it closes the retention-vs-subscription
question left open in `team/ceo.md` § Now and in `BUSINESS.md` days 11–18. Wrote this brief and the
five leads above. The load-bearing ones: the padlock is both the overwhelm and the paywall; a
recurring charge needs recurring value and we may not have any yet; and no standing decision is
available to be traded for conversion in this wave.
Changed: `tasks/simpler.md` (new).
Next: dispatching the research wave — Product Designer, Growth Lead, Research Lead.

### Product Designer — started 21:16:51

Brief: research-and-proposal wave on making the UI/UX simpler and less overwhelming, and making it attract subscribers. No code or file changes except this log. Reading CLAUDE.md, team/README.md, team/product-designer.md, tasks/simpler.md, UI-WIRING.md, then the real screens (App.tsx, src/ui/**, src/data/presets.ts, src/services/entitlements.ts). Will deliver: honest first-run decision count from code, before/after simplification proposal, padlock redesign, paywall shape against current subscription research with URLs, and a category check (Calm, BetterSleep, Endel, Portal, Sonora) with URLs.


### Growth Lead — started 21:17:08

Pricing and tier-shape proposal. Founder has ruled: there will be a subscription. Reading CLAUDE.md, team/README.md, team/growth-lead.md, tasks/simpler.md, BUSINESS.md, MONETIZATION-WIRING.md, and the billing/entitlements/ads/PaywallSheet sources. Changing no files except this log. Deliverable: what recurs, tier shape + price with arithmetic, the ask moment, the metrics to instrument, and what I refuse to ship.


### Research Lead — started 21:17:35

Brief: claim veto over the Designer's simplification and the Growth Lead's subscription proposal. Reading research.md, src/data/evidence.ts, EvidenceSheet.tsx, PaywallSheet.tsx and the BUSINESS.md store copy for drift, then checking whether any headline finding has been superseded. Changing no files except this log. Deliverable: which parts of the evidence surface are load-bearing vs reducible, the claim rules a paid tier must design inside, drift already present in shipping copy, the workload a recurring-content promise commits this role to, and whether the free four still earn "strongest evidence".

### Research Lead — finding filed mid-task (the one that changes the task)

**A 2026 lab RCT lands against our default sound, and it landed four months ago.**

Basner M, et al. "Efficacy of pink noise and earplugs for mitigating the effects of intermittent
environmental noise exposure on sleep." *Sleep.* 2026;49(5):zsag001.
n = 25 healthy adults (mean age 28.5 +/- 5.9, 7 male). Seven-night randomised crossover, in-lab
polysomnography, 8-hour sleep opportunities. Conditions: quiet control; environmental (aircraft)
noise; pink noise alone at 50 dB; EN + PN at 40 dB; EN + PN at 50 dB; EN + foam earplugs.

- Pink noise alone at 50 dB vs quiet control: **REM sleep reduced by 18.6 minutes** (z = -0.79, p = .0003).
- EN + PN50 vs control: **29.0 fewer REM minutes** (p < .0001); REM latency **+26.8 min** (p < .05).
- Earplugs + EN: no significant difference from control on sleep structure; **+16.9 N3 minutes**
  versus EN alone (z = 0.59, p = .0003).
- Authors' framing: adding pink noise to environmental noise "worsened sleep structure, despite minor
  dose-dependent improvements," and they caution against widespread broadband-noise use.
<https://academic.oup.com/sleep/advance-article/doi/10.1093/sleep/zsag001/8452884>

Independently confirmed by the accompanying editorial — Garcia Molina G. "Protecting sleep in a noisy
world." *Sleep.* 2026;49(5):zsag032: "continuous pink noise exposure resulted in significant
dose-dependent REM sleep reduction," with concern flagged over "REM's critical role in emotional
memory consolidation, emotion regulation, fear extinction, and neurodevelopmental processes."
<https://pmc.ncbi.nlm.nih.gov/articles/PMC13163172/>

I went looking for the other side and it does not rescue us. Vincens N, Nause A, Basner M, et al.
"Pink noise reduces impact of traffic noise on sleep and the blood metabolome: a cross-over pilot
study." *Communications Medicine.* 2026;6:114. n = 12, five nights. Pink noise did attenuate
noise-induced arousal under traffic noise (peak ORP p = 0.003; ORP area under curve p < 0.0001) — but
the authors state **"no significant improvements in sleep macrostructure compared to the quiet
condition"**, no effect on percentage of REM, and that "auditory fatigue and several measures of
perceived sleep quality and sleep disturbance were negatively affected."
<https://pmc.ncbi.nlm.nih.gov/articles/PMC12901012/>

**What this does and does not overturn.** It does not overturn *masking*: pink noise still beats
noise. It overturns **pink noise as a thing you add to a quiet room all night**. Read together, the
2026 evidence says: against a noisy background, masking helps arousal but not architecture; against a
quiet background, continuous pink noise at 50 dB costs you REM.

**This vindicates standing decision 3 and destroys one sentence of our marketing.** The 45-minute
timer defaulting ON is now the best-evidenced design decision in the product — we already refuse to do
the thing that was just shown to cost REM. But "the best available evidence is for pink noise"
(BUSINESS.md full description) is no longer a sentence I will sign.

The charter told me to watch for exactly this and said the honest move is to change the badge and say
so. I hold to that: **this is a better story than the one it replaces**, and it is the only story in
this whole wave that a journalist would actually run. "We shipped a sleep app, the evidence moved
against our own default sound, and we changed the badge and told our users" is the positioning
working in public. It is also the single strongest argument that our badges are real and not
decoration — which is precisely the thing a paywall makes people doubt.

Supporting, and the reason pink is not simply demoted to nothing: Capezuti E, Pain K, Alamag E, Chen
XQ, Philibert V, Krieger AC. "Systematic review: auditory stimulation and sleep." *J Clin Sleep Med.*
2022;18(6):1697-1709 (PMID 34964434). 34 studies, 1,103 participants. Pink noise had the highest rate
of positive outcomes (**81.9%**) versus white (**33%**) and multi-audio (66.7%), and no study reported
adverse effects from short-term application — but the reviewers concluded there was insufficient
evidence to strongly endorse any of it. <https://pubmed.ncbi.nlm.nih.gov/34964434/>

That is the honest resolution: **pink over white survives. Pink as "Strong" does not.**

**My ruling, and it is a veto, not a suggestion:** pink noise moves from **Strong** to **Moderate**,
and its evidence card gains the Basner 2026 counter-evidence the same way white noise carries Riedy
2021. Short-term masking for sleep onset stays claimable. All-night pink noise does not. No
subscription, paywall, store listing or launch post ships while the app still tells a paying user that
pink noise has "the best evidence" full stop.

I could not open the source behind one figure I saw quoted in search results comparing outcome rates,
until I found the PubMed record above. The rule held: what I could not open did not go in.


### Research Lead — 1. Where simplification breaks the positioning

For the Product Designer, at the level asked for: element by element, on the surface as it renders
today in `EvidenceSheet.tsx` and on the layer cards that lead into it.

**Load-bearing. I will veto the removal of these.**

1. **The badge chip at the point of choice** — on the layer card, not only inside the sheet. This is
   the single most load-bearing pixel in the product. A badge that only exists after a user opens a
   sheet is a badge that most users never see, which makes "we grade our own evidence" invisible in
   the default flow and therefore decorative. If density forces a cut, cut the *label text* and keep
   the *chip*. Reducing eleven cards to a shorter list is fine. Reducing eleven badges to zero is not.
2. **The source links, with a real journal name and a URL that resolves.** The positioning is
   falsifiable on purpose. "Cites its sources" survives exactly as long as a reader can click. A
   "learn more" that goes to our own prose instead of the paper ends the claim.
3. **The counter-evidence, and its adjacency.** The white-noise card linking Riedy 2021, and the
   badge legend's line "including when the answer is 'not very'". This is not balance for its own
   sake — my charter is explicit that this *is* the pitch, and it is now doubly so, because I am
   adding Basner 2026 to the pink card. Counter-evidence must sit on the same card as the claim it
   qualifies. Moving all counter-evidence to one "limitations" screen is the most plausible-looking
   simplification available and it is the one that guts us: it converts per-claim honesty into a
   disclaimer, and disclaimers are what every other app already has.
4. **The medical-device footer** on the evidence card. Standing decision 6 and the disclaimer in
   `research.md` and `PRIVACY.md`. Short, and it stays.
5. **"Experimental" adjacent to Deep Pulse, and "Headphones required" adjacent to binaural, at the
   point of selection.** Not inside the sheet. Not on hover. These two are the app's two dangerous
   claims and both fail *silently* — a user on a phone speaker hears something and assumes it worked.
6. **The badge legend being reachable in one tap from anywhere a badge appears.** A badge whose
   definition cannot be found is a marketing sticker. Currently it opens from the Layers header; if
   that header goes in a simplification, the legend needs a new door before the old one closes.
7. **The ocean card's "breathe in as the wave rises" instruction, next to the ocean badge.** See the
   drift list — ocean's Strong badge is evidence about *paced breathing*, not about listening. The
   instruction is what makes the badge honest. Separate them and the badge becomes unearned.

**Genuinely reducible. Cut these before you touch anything above.**

1. **The `detail` paragraph, at rest.** Two to four sentences of methods prose on every card. This is
   the bulk of the density and it is the least load-bearing part, because the `claim` line already
   carries the point in one sentence and was written to. Badge + claim + one source visible; detail
   and full source list one tap deeper. This is progressive disclosure applied to the evidence card
   itself and it costs nothing.
2. **`BADGE_MEANING` repeated beside every chip in every card.** That is the legend, inlined eleven
   times. Show it on first encounter, or only in the legend. Pure duplication.
3. **The "The evidence" eyebrow** on the card header. The sheet is already the evidence sheet.
4. **Source label verbosity.** "Alvarsson 2010, Int J Environ Res Public Health" can be "Alvarsson
   2010" with the journal on the destination. The year and first author are what make it checkable.
5. **The volume guide as a peer surface.** It can live behind the volume control instead of alongside
   the sounds. It is excellent and almost nobody ships it, but it is not competing for the same
   attention as the layers.

**The asymmetry, in one line, because this is the thing the Designer needs before they cut:**
*prose is reducible, calibration is not.* Every sentence on the evidence surface can be shortened or
deferred. Every badge, source link and counter-citation is the product.

**Two simplifications I will refuse on sight, because both are natural and both are fatal:**

- **Hiding badges on locked layers, or revealing evidence only after purchase.** This is the most
  likely accidental outcome of the padlock redesign, since a locked card is exactly where a designer
  reduces detail. It would mean selling a sound on an evidence basis the buyer could not inspect
  first. The correct direction is the opposite: the badge and the evidence card must be fully
  readable *while locked*. That is also the better conversion argument (reasoned, not measured) — the
  evidence card is our best sales asset and locking it hides the reason to buy.
- **Ordering or featuring paid layers by badge strength on the paywall.** That silently converts the
  badge from an honesty instrument into a sales ranking, and it will pull weak-badged layers out of
  view. Informative: yes. Merchandising order: no.

### Research Lead — 2. The claim rules for a paywall

Binding on the Growth Lead and the Product Designer. Design inside these; argue with me if one blocks
something real, but do not ship past one.

**R1 — A paywall describes what you get, never what it will do to you.** Permitted verbs: unlocks,
includes, adds, removes ads, saves. Forbidden on any paid surface: improve, enhance, boost, deepen,
restore, optimise, fix, treat, cure. "Every layer, every scene, no ads" is a feature list and it is
fine. "Sleep deeper" is a claim, and on a paywall it is a promise.

**R2 — The grammar test for the medical-claim line.** We may state what a sound does *acoustically*
("masks traffic", "steady", "0.1 Hz swell") and what a *cited study found* ("in a 40-person study,
X"). We may never state what it will do *for the user*. If the subject of the sentence is "you" or
"your sleep", it is a claim. And naming a condition is the tripwire, regardless of hedging: insomnia,
apnoea, anxiety, ADHD, tinnitus, depression. Do not name one as something Quietloom addresses.
`BUSINESS.md` step 8 already says therapeutic claims get the listing rejected; this is the operational
version of that rule.

**R3 — Deep Pulse behind a price.** The highest-risk item in the product.
  - May be *listed*, never *sold*. Not a headline benefit, not a tier name, not the hero of a
    screenshot.
  - Never "slow-wave enhancement", "deep sleep mode", "boosts deep sleep", or any variant, anywhere —
    including any string that can be truncated into one. See the drift list: our current wording is
    accurate but truncates badly, and paywall bullets and store fields truncate.
  - "Experimental" appears in the same visual unit as the name, at no less prominence than the price.
    In a benefit list it reads "Deep Pulse (Experimental)".
  - The open-loop limitation is at most one tap from the paywall itself.
  - And its badge must be fixed first — see D6. As it stands the badge asserts controlled evidence
    for a thing that has none.

**R4 — Binaural behind a price.** "Headphones required" in the same visual unit as the name,
everywhere it is sold — not a footnote, not a tooltip, not only inside the evidence sheet. A user who
pays for binaural and plays it on a phone speaker has bought something that physically cannot work.
That is not merely an over-claim; on Google Play it is a "product not as described" refund, and at
volume it is a chargeback pattern.

**R5 — Charging raises the bar, and here is exactly why.** Three reasons, all of which the Growth Lead
should have in writing:
  (a) A free app's description is puffery. A paid product's description is an **offer**, and
      statements that induce a purchase are treated differently from statements that induce a
      download.
  (b) A subscription **re-asserts its claim every billing period**, to a user who by then has months
      of personal evidence to test it against. An over-claim a free user shrugs off, a subscriber
      charges back and reviews.
  (c) Our entire defence against a hostile reader is "we told you the evidence was weak." That
      defence collapses if the weak-evidence disclosure lived on the free surface and the confident
      version lived on the paid one.
  **Operational rule, and it is the one I would enforce hardest: the paid surface carries the same or
  MORE hedging than the free surface, never less.** Any paywall copy more confident than the layer
  card it sells is automatically vetoed. This is a mechanical test the Designer can self-apply.

**R6 — A badge shown on a paywall must bring its legend, and must not be filtered.** If the paywall
displays badges at all, the meanings are reachable and at least one sub-Strong badge is visible. A
paywall showing only Strong badges is a filtered claim even if every individual badge is true.

**R7 — Trials may not be described in outcome terms.** "Free for 7 nights" is fine. "See the
difference in 7 nights" promises an effect inside a window, and nothing in `research.md` tests a
seven-day outcome for anything we ship. The absence is checkable; the promise would not be.

**R8 — No evidence-ranking claim about the free tier until D1/D5 below is resolved.** The sentence
currently on the paywall is not true.

**R9 — All of the above applies identically to the store listing, the screenshots and their captions.**
`BUSINESS.md` section 4 is a claim surface, and two of its captions and three of its sentences already
need edits.


### Research Lead — 3. Drift already shipping, whether or not it is in scope

The charter tells me to verify that claims in the marketing match what the bibliography supports. It
does not, so here is the register. I checked the strings myself in the files named; a fan-out sweep
found the candidates and I re-read every load-bearing one before writing it down.

**D1 — The paywall states an evidence ranking that is false, at the moment of sale.**
`PaywallSheet.tsx:251-254`: "Rain, Ocean, Pink noise and Brown noise stay free forever — those are the
four with the strongest evidence behind them." In `evidence.ts` the **Strong** badges are rain (L19),
ocean (L41), **fire (L63)** and pink (L83). Brown is **Moderate** (L94). `entitlements.ts:10` sets
`FREE_SOUNDS = ['rain', 'ocean', 'pink', 'brown']`. So the free four are three of the four Strong
layers plus one Moderate, and campfire — which rests on the largest, best-designed primary study in
the whole bibliography — is behind the paywall. **Veto. This sentence cannot ship as written**, and it
matters more now than yesterday because it is the sentence people read while deciding to pay.

**D2 — The same claim exists in three strengths across three files.** `PaywallSheet.tsx:251` says
"the four with the strongest evidence"; `BUSINESS.md:652-653` says "four of the five with the
strongest evidence"; `entitlements.ts:3` says "the four layers with the best evidence". The
`BUSINESS.md` version is also independently wrong — there are four Strong badges, not five. One fact,
three formulations, none accurate. This is the drift the charter exists to catch.

**D3 — "The best available evidence is for pink noise" is superseded.** `BUSINESS.md:605-609` and
`evidence.ts:84` ("The noise with the best evidence"). See the Basner 2026 section above. Both must
change. `BUSINESS.md:64-66` ("Zhou 2012 is the strongest noise result available") is the same claim in
the strategy narrative; Basner 2026 is a larger, better-controlled, polysomnographic crossover and it
points the other way, so on study quality that sentence is no longer defensible either.

**D4 — The banned phrase is shipping in three places.** `HANDOFF.md:268` carries a section titled "Do
not let anyone describe Deep Pulse as slow-wave enhancement" and `team/qa-verification.md:86` has it as
a release checkbox. Yet **"slow-wave enhancement protocol"** appears verbatim at `evidence.ts:128`,
`presets.ts:104` and `BUSINESS.md:631-632`. Each instance is *technically* accurate — Papalambros's
protocol genuinely is one, and we say "modelled on" — which is presumably how all three passed. My
ruling: the qualifier does not survive truncation, and every surface money touches truncates. A
paywall bullet, a Play Store snippet, a screenshot caption or a shared link renders "Deep Pulse:
rhythmic pink-noise pulses modelled on a slow-wave enhancement..." and the user has just read a
slow-wave enhancement claim. **Replace with wording that is safe when cut**: "Deep Pulse: rhythmic
pink-noise pulses at about 0.8 Hz, open-loop. Experimental." `LayerCard.tsx:37` already uses the
softer "slow-wave protocol" and is the closest to acceptable.

**D5 — Deep Pulse's badge fails its own legend.** `evidence.ts:127` badges it **Emerging**, which
`theme.ts:76-81` defines to the user as "Promising controlled results, small samples, not widely
replicated." The controlled results are for **closed-loop, EEG-phase-locked** stimulation. We run
open-loop at a fixed ~0.8 Hz and the card says so honestly. There are no controlled results for the
open-loop version, so the badge asserts evidence that does not exist for the thing being sold.

And the phase is the mechanism, not a detail: Navarrete M, Schneider J, Ngo H-VV, Valderrama M, Casson
AJ, Lewis PA. "Examining the optimal timing for closed-loop auditory stimulation of slow-wave sleep in
young and older adults." *Sleep.* 2020;43(6):zsz315. n = 21 young (mean 25.7) + 17 older (mean 55.0).
Enhancement was maximal at a specific phase of the ongoing slow oscillation (near the positive peak,
about 66.4 degrees); post-stimulus slow waves were 39.6 microvolts larger than spontaneous ones in
young adults (95% CI 30.5 to 48.7) but only 18.3 microvolts in older adults (95% CI 11.1 to 25.6),
significantly lower (p < .001), with the effective window narrowing with age.
<https://academic.oup.com/sleep/article/43/6/zsz315/5686285>
A fixed-rate open-loop train cannot target that window; it drifts across all phases. Whether the net
effect of random-phase stimulation is neutral or negative is not established in either direction
(reasoned, not measured) — and "not established in either direction" is exactly what Emerging does not
mean. **Ruling: Deep Pulse cannot hold Emerging while it sits behind a price.** Either it drops to
Traditional, or the badge set gains a real **Experimental** tier below Emerging, defined as
"reproduces the pattern of a tested protocol without the mechanism that made it work." I prefer the
second and recommend it: it is more honest, it is a better story, and it stops "Experimental" being
loose prose sitting next to a badge that contradicts it.

**D6 — The worst single finding: we ship an untested binaural frequency and sell a benefit for it.**
`LayerCard.tsx:47-51` offers three preset chips. "Sleep — Fan 2024, 0.25 Hz @ 250 Hz" is exactly the
tested parameter and is a model of how this should be done. "Delta, 3 Hz @ 250 Hz" sits inside the
1–4 Hz range of the delta pilot — acceptable. **"Alpha / focus, 10 Hz @ 250 Hz" has no source
anywhere in `research.md`.** Section 5 covers 0.25 Hz (Fan 2024) and 1–4 Hz delta. Ten hertz is
neither. And `presets.ts:89-98` ships it as the "Focus Flow" preset with the note "Pink noise plus a
10 Hz alpha beat and light rain. **For work, not sleep.**" — a cognitive-performance claim, with no
citation, on a paid layer.

This is precisely the failure mode my charter names: "Inventing plausible numbers and attaching a
citation to them is the failure mode this role exists to prevent." The layer carries an **Emerging**
badge earned by Fan 2024 at 0.25 Hz, and that badge travels with every parameter the user can dial —
the Beat slider runs 0.25 to 12 Hz and the Carrier 80 to 400 Hz (`LayerCard.tsx:283-300`). The badge is
attached to the layer; the evidence is attached to one point in that space. **Veto, and this one I
would fix before the subscription regardless of what the tier looks like:** either cite a source for
10 Hz alpha that meets the bar, or remove the chip and the Focus Flow preset, or relabel both so no
benefit is implied and the badge is visibly scoped to the Fan 2024 setting. "For work, not sleep" must
go either way — it promises focus, and we have nothing.

**D7 — Prominence of the two dangerous caveats is inverted by lock state.** `LayerCard.tsx:222` gates
the whole card body on `unlocked && on`, and inside it sit the two amber notices: "**Headphones
required.**" for binaural (L262-266) and "**Open-loop approximation.**" for Deep Pulse (L305-309).
Neither layer is free, so a free user never renders either notice.

I want to be exact rather than dramatic here, because the strong version of this claim is wrong: the
free user is *not* left uninformed. The badge chip renders regardless of lock state (L143), the
one-line description renders (L146), the info dot is outside the gate (L150) and `openEvidence` is not
entitlement-checked — so the full evidence card, including "Headphones required — the effect
physically cannot happen on a speaker", is one tap away while locked. And the card description itself
says "Physically impossible on a speaker" (`LayerCard.tsx:36`) and "Experimental" (L37).

The accurate finding is narrower and still worth fixing: **the most prominent form of each caveat
appears only after unlocking.** Hedging currently increases after purchase. That is the exact inverse
of R5, it will read badly to anyone who reconstructs it, and once there is a subscription the person
who most needs "headphones required" before deciding is the person who has not paid yet. Move both
notices outside the `unlocked` gate. Cheap fix, and it removes the whole argument.

**D8 — "Traditional" is never assigned to anything.** `types.ts:75` defines four badges and the legend
advertises four; `evidence.ts` uses only Strong, Moderate and Emerging. Traditional appears solely as
a fallback for an unknown id (`LayerCard.tsx:119`). A four-point scale whose bottom rung is never used
is inflated by construction: every layer in the app is at least "promising controlled results". This
weakens every badge above it and it is the structural reason D5 happened. Before any recurring-content
promise exists, Traditional needs to be a badge we actually use, in public, on something.

**D9 — Ocean's Strong badge is inherited from breathing research, and simplification can break it.**
`evidence.ts:39-49` badges ocean **Strong** citing Sevoz-Couche & Laborde 2022 and Front Psychiatry
2018 — both studies of *paced breathing at 0.1 Hz*, neither a study of *listening to a ten-second
swell*. The card is honest, because the detail carries the instruction that supplies the mechanism:
"Breathe in as the wave rises, out as it falls." The badge is earned by the behaviour, not the audio.
**This is the single most concrete way the Designer's simplification could break the positioning:** if
the detail paragraph is deferred behind a tap (which I have explicitly endorsed as reducible) while
the Strong chip stays on the card, the badge becomes unearned in the default view. If the instruction
moves, the badge moves with it or drops to Moderate. Flagging this is exactly why the Designer needed
my pass before cutting rather than after.

**D10 — Rain's Strong badge rests on two studies, one of which contains no rain.** Alvarsson 2010 used
fountain and birds; Kumpulainen 2025 used a composite soundscape in which rain was one of seven
elements. Neither isolates rain. Two studies with a consistent direction technically clears the Strong
bar, and nature-sound-versus-noise is a real finding, so I am **not** vetoing this today. I am
recording it, because standing decision 4 leans on rain being top-four evidenced and the honest
description is "best-evidenced among the nature layers, on composite-soundscape evidence."

**D11 — The nursery claim, our most safety-adjacent one, cites two blogs.** `evidence.ts:181` cites
parentdata.org and `research.md:220` cites getsnooz.com for the AAP 50 dB / 2 m / never-at-maximum
guidance, and it is rendered in `VolumeGuide.tsx:110-113` and `MasterRow.tsx:53`. Blog sourcing on a
safety feature is below our own bar, and `BUSINESS.md:725-726` targets nursery keywords. The primary
exists and I opened it: **Hugh SC, Wolter NE, Propst EJ, Gordon KA, Cushing SL, Papsin BC. "Infant
Sleep Machines and Hazardous Sound Pressure Levels." *Pediatrics.* 2014;133(4):677-681.** Fourteen
infant sleep machines measured at maximum volume at 30, 100 and 200 cm using correction factors for a
6-month-old's ear canal: **all fourteen exceeded 50 A-weighted dB at 30 cm** — the recommended nursery
limit — and **three exceeded 85 dBA**, which over more than eight hours exceeds adult occupational
accumulated-noise limits.
<https://publications.aap.org/pediatrics/article/133/4/677/32749/Infant-Sleep-Machines-and-Hazardous-Sound-Pressure>
Swap the blogs for this. **One caution I will not paper over:** the "at least 2 metres / 7 feet" figure
is a distance recommendation *derived from* this measurement work, and I could not verify that
specific number in the primary I opened, which measured at 30/100/200 cm. Until someone verifies 2 m
in a primary source, the app should say "as far from the crib as practical, and never at maximum"
rather than assert a number we cannot point at. My rule: if I cannot open it, it does not go in — and
that applies to a number as much as to a study.
Related and newly urgent: the Basner 2026 editorial flags **neurodevelopment** as the reason REM
reduction matters. We market a nursery cap. The cap limits *level*; the new evidence is about
*duration of continuous exposure*. A nursery-safe cap that does not also bound duration is now
arguably incomplete (reasoned, not measured — nothing tests our specific cap).

**D12 — Lock-screen labels carry no caveat.** `background.ts:40-41` renders "Binaural Beats" and "Deep
Pulse" in the media notification with no badge and no qualifier. Low priority — a media notification is
not a claim surface and cramming a caveat in would be worse — but noting it so nobody later treats the
lock screen as a place to advertise a paid layer. It is not.

**D13 — Verification note on Lynn 2014.** URL resolves and points at the correct paper: *Evolutionary
Psychology* 12(5):983-1003. Results verified: systolic fell 5.9 (SD 7.36), F = 45.04, p < .001;
diastolic fell 3.0 (SD 7.53), F = 7.40, p = .001; fire-with-sound differed from control (p < .01) and
from muted fire (p < .01). **But** `research.md:112` and `evidence.ts:66` both say "226 adults", and
the paper as I read it reports 167 in studies 1 and 2 combined plus 60 in study 3, which sums to 227.
One of those is wrong by one. Someone should check it against the PDF and fix whichever it is. I flag
a one-person discrepancy because the entire positioning is that our numbers survive a reader checking
them.

**D14 — Store copy says six presets; `presets.ts` ships nine.** `BUSINESS.md:633`. Trivial, and it is
in the paste-ready listing.

**D15 — `BUSINESS.md:840-842` plans an HN launch around a web demo.** "the app runs in a browser, so a
link where they can hear the synthesis in one click will multiply your conversion enormously."
`CLAUDE.md` states there is no web build and no browser dev mode, and that stale references must be
fixed. Not a claim and not my file, but the highest-upside item in the launch plan currently depends
on something that does not exist, and I was asked to read this document.

**D16 — My own charter points at the wrong filename.** `team/research-lead.md` and `research.md:5` both
name `src/data/evidence.js`; the file is `src/data/evidence.ts`.


### Research Lead — 4. What a recurring-content promise commits this role to

The CEO asked for this in workload terms so it can be priced into the decision. Here it is.

**The unit cost.** For a new layer to carry a badge that survives its own legend, the pipeline is:
find candidate literature; open and read the primary sources rather than abstracts; confirm the
parameters we intend to synthesise are the parameters that were actually tested; write the claim and
detail with the numbers quoted from the paper; assign a badge against the bar; then go and find the
counter-evidence and include it. That is what produced the entries currently in `evidence.ts`.

**My estimate: 4 to 8 hours of genuine reading per new layer that gets a real badge, with a material
probability of returning "no usable evidence — ships as Traditional or not at all."** (reasoned, not
measured — this is my estimate from having produced the existing entries, not a timed measurement.)

**The trap is arithmetic, and it is already written down.** `BUSINESS.md:938-940` lists the cheap
content wins: "a summer thunderstorm, a train carriage, a coffee shop, a fan, a heartbeat, aeroplane
cabin, distant city rain." Every one is a parameter set on machinery that already exists — genuinely
cheap to build, which is exactly why they are the candidates. **Not one of them has a plausible primary
literature of its own.** There is no sleep RCT for a train carriage.

And one of them is worse than unevidenced. A coffee shop appears in our bibliography exactly once —
**as the control condition Kumpulainen 2025 compared against.** The nature soundscape beat the
coffee-shop reference on HF power (p = 0.01), heart rate (p = 0.004) and respiratory rate (p < 0.001).
Shipping a coffee-shop layer as premium content and badging it favourably would mean selling, as a
paid benefit, the comparator our own cited study used to demonstrate the opposite.

**So the commitment, stated so the CEO can price it:**

- Every recurring drop is either (a) badged **Traditional**, which says out loud "no direct controlled
  evidence for this specific claim", or (b) costs 4–8 hours of my reading and may still come back
  empty.
- Twelve months at one layer per month is roughly **50 to 100 hours of research a year**, unevenly
  distributed, with a non-zero rate of "the answer is no."
- If most drops are honestly Traditional, then within about a year **the majority of paid content
  carries the weakest badge while the free four carry the strongest.** A subscriber can see that. "I
  pay every month and everything I pay for is badged Traditional" is a churn argument and a one-star
  review, and it is *true*. That is a product problem created by honesty working correctly, and it is
  better to see it now than in month seven.
- The real failure mode is not that we lie. It is **badge inflation**: month seven arrives, nothing
  new is defensible, and there is pressure to badge a fan noise Moderate because it is this month's
  drop. I will refuse those one at a time, and refusing them one at a time will be experienced as
  Research blocking the roadmap every single month. D8 above shows the drift has already started —
  Traditional exists in the legend and has never once been used. **Decide the policy now rather than
  having this fight twelve times.**

**My recommendation on what recurs, as a research position rather than a pricing one.** The honest
recurring value in this product is not new sounds. It is **the bibliography itself**. It is not
static — it changed materially today, four months after the finding published, and it changed against
our own default sound. A subscription whose recurring deliverable is "we keep reading the literature
and we tell you when it moves, including when it moves against us" is (i) the only recurring thing we
can actually supply at the bar we have set, (ii) undifferentiable by any competitor, because none of
them has a bibliography to update, and (iii) self-reinforcing — every update is evidence the badges
are live rather than decorative. Basner 2026 would have been issue one, and it is a genuinely
interesting thing to receive.

I am not the pricing owner and this may be commercially far too thin to carry a subscription on its
own. That is the Growth Lead's call and the CEO's ruling. But it is the one recurring promise I could
sign every month for years without inflating anything, and I would rather put it on the table than
only say no to the alternative.

**One further constraint on subscriber content, from a prior ruling of my own.**
`WelcomeScreen.tsx:9-11` records it: "nothing anywhere may imply that looking at a screen helps you
sleep — the scenes are pleasant, and that is the entire claim." `BUSINESS.md:928-929` proposes "more
scenes" as subscriber-only content. Scenes are sellable as **aesthetics** and nothing else. A
subscription tier may not present additional scenes as a sleep benefit, and the moonrise card's
careful framing ("a nod to that finding, not a reproduction of it") is the model for how far that can
be pushed — which is not far.

### Research Lead — 5. The free four

Standing decision 4's **policy** — four genuinely useful layers, free forever — I support without
reservation, and it is not what I am questioning. Its **justification** has drifted, and the
justification is what is printed on the paywall.

As of today, "the four with the strongest evidence" is not accurate, for four separate reasons:

- **Campfire is Strong and locked.** It rests on Lynn 2014 — randomised crossover, ~227 participants
  across three studies, with the muted-fire control that makes the result interesting rather than
  merely positive. On design quality it is the best primary study in the bibliography and it is behind
  the paywall.
- **Brown is Moderate and free.**
- **Pink should be Moderate too**, after Basner 2026.
- **Ocean's Strong is conditional** on the breathe-with-it instruction staying next to the badge (D9).

After my rulings the free four would read Strong / Strong-conditional / Moderate / Moderate, with the
strongest single study in the app sitting on the paid side.

**Three ways out, and the founder is about to build a business on which one gets picked:**

1. **Change the sentence, not the tier.** The free four stay exactly as they are; the paywall says
   something true and unfalsifiable-by-a-hostile-reader. For example: "Rain, ocean, pink and brown are
   free forever. Between them they cover the two things the evidence supports best — nature sound for
   stress recovery, and steady masking for falling asleep." No ranking claim, no superlative, nothing
   that breaks when a badge moves. **This is my recommendation.** It costs nothing, it ships in the
   same change as the pink badge, and it makes the sentence immune to the next finding.
2. **Change the tier to match the sentence.** Move campfire into the free set. Honest, and expensive —
   it takes the most emotionally appealing layer out of the paid library. That is a Growth and CEO
   decision, not mine, and I note only that it is the option that makes standing decision 4 literally
   true.
3. **Keep both and be wrong.** Not available. It is on the paywall, at the moment of sale, and it is
   the one claim a hostile reader can check in about ninety seconds using nothing but our own app.

Whichever is chosen, **all three formulations in D2 must end up saying the same thing**, and
`entitlements.ts:3` is a code comment that will drift again unless it points at the decision rather
than restating it.

### Research Lead — my position, and where I expect to disagree

Neither the Designer nor the Growth Lead had filed when I wrote this, so this is stated in advance
rather than in reaction. It is not a prediction about them; it is the list of things I will refuse
regardless of who proposes them, published early so nobody wastes a wave designing into a veto.

**I will refuse:**

1. Any paywall or store string that survives truncation as a health claim (D4), and any benefit
   bullet whose subject is "you" or "your sleep" (R2).
2. Deep Pulse sold as a headline paid benefit, at all, in any tier — and its Emerging badge going
   behind a price unfixed (D5).
3. Binaural sold without "headphones required" in the same visual unit (R4), and the 10 Hz alpha chip
   and Focus Flow preset shipping as they stand (D6).
4. Any simplification that removes badges from the point of choice, hides the evidence card on locked
   layers, or consolidates per-claim counter-evidence into a single limitations screen (section 1).
5. Any paywall copy more confident than the free layer card it sells (R5). This is the mechanical test
   and it catches most of the rest.
6. "New sounds every month" as a promise, until the CEO has ruled on the Traditional-badge policy in
   section 4. Not because recurring content is wrong, but because the badge system cannot absorb
   twelve unevidenced drops and the pressure will land on me one month at a time.

**Where I expect the genuine tension to be, and my honest answer to it.** The Designer will want to
reduce what is on screen; the Growth Lead will want the paywall to be more persuasive. Both are right
and both pull the same lever, which is *how much evidence is visible and when*. My position is that
these are not actually in conflict, and the resolution is the same move for both: **the evidence card
is the best conversion asset in the app, so it should be more visible while locked, not less.** A
padlock that says "Locked" and nothing else is simultaneously the most overwhelming and the least
persuasive thing we could put there. A locked card showing the badge, the one-line claim and a
readable citation is *less* visually noisy than a slider-and-controls card, and it is the only
argument we have that is not "pay us". I do not need to trade positioning for conversion here and I
would resist framing it as a trade.

**The disagreement I do expect to be real** is timing. If the Growth Lead lands on the ask moment
being session two or day two, I have no objection on claim grounds. If it lands on minute one with a
trial framed in outcome terms, R7 blocks it, and that will feel like Research vetoing the conversion
plan. It is not — "free for 7 nights" is available and costs nothing. Only "see the difference in 7
nights" is refused.


### Product Designer — finished 21:25:51

Did: read the real screens rather than the docs, counted first-run decisions from code, and wrote the
proposal below. Changed: nothing but this log. Every claim is either a URL or marked
`(reasoned, not measured)`. We have zero users, so nothing here is measured on our own product.

---

## 0. The finding that reframes the brief

**The defaults are already right. The disclosure half was never built.**

`src/core/store.ts` `DEFAULT_SETTINGS` is: timer **45 min, ON**; breathing **coherence** (6 bpm, the
better-evidenced pattern); `chime` off; `nurserySafe` off; `reduceMotion` off. `App.tsx`
`DEFAULT_PRESET = 'rainfall'`, which is rain + pink, both in `FREE_SOUNDS`. Those are good, opinionated,
research-led defaults and nobody has to touch any of them to use the app well.

So the CEO's Lead 1 prior — "a strong default plus progressive disclosure, not deleting features" — is
correct, and **half of it already shipped**. The gap is not that we lack good defaults. The gap is that
every control whose default is already correct is still rendered at full weight, full opacity and full
prose on the arrival screen. We built the answers and then showed all the questions anyway.

That reframing matters because it changes what the work is. It is not a feature cull and it is not a
redesign. It is *moving things one layer down* — which is cheap, reversible, and touches no engine, no
audio, no evidence data.

---

## 1. The honest count: what a first-time user is asked to decide

Traced from `App.tsx` → `WelcomeScreen.tsx` → `MixerScreen.tsx` → `LayerCard.tsx` / `PresetRow.tsx` /
`MasterRow.tsx` / `BottomBar.tsx`, with `Entitlements.FREE_SOUNDS = ['rain','ocean','pink','brown']`.

### Screen 0 — WelcomeScreen

One decision: tap. Correct, and the best screen in the app.

Two defects:

- **It is not onboarding, it is a nightly toll gate.** `Root` does `const [welcoming, setWelcoming] =
  useState(true)`, unconditionally. There is no `seenIntro` check on this path (`KEYS.seenIntro` is read
  only by `maybeOpeningInterstitial`). So every cold start shows the meadow, waits `HINT_DELAY_MS = 900`
  for "TAP TO BEGIN" to fade in, then `DIP_IN_MS 240` + `DIP_OUT_MS 420`. Roughly 1.6 s and a mandatory
  tap before the mixer exists, every single night, forever.
- **"Tap to begin" begins nothing.** The tap runs `enterFromWelcome()`, which swaps the scene and mounts
  the mixer. No audio. The user must then find **Play** in the bottom bar — a second, unhinted tap they
  were never told about. The app's first promise is unkept by its own first interaction.
  `(reasoned, not measured)`

### Screen 1 — MixerScreen, first run, non-premium, before any tap

Interactive targets in a single scroll:

| Block | Targets |
|---|---|
| Header: "Premium" `GhostButton` → `openPaywall` | 1 |
| "My mixes" link | 1 |
| Preset chips (`PRESETS` has 9) | 9 |
| "What the badges mean" link | 1 |
| 11 `LayerCard` head pressables | 11 |
| 11 `InfoDot`s (one per card) | 11 |
| Sliders visible on first run (rain Level, rain Intensity, pink Level) | 3 |
| Master slider + its `InfoDot` | 2 |
| Reduce-motion `SwitchPill` | 1 |
| Bottom bar: Play / Timer / Breathe / Bedside | 4 |
| **Total** | **44** |

Plus, non-interactive but competing for the same attention: **19 blocks of explanatory prose** (welcome
tagline, header tagline, 3 group notes, 11 card body lines from `COPY`, the preset note, the master
volume note, the reduce-motion sub, the disclaimer), **11 badge chips**, and **1 ad banner**.

Reachable in one more tap: Timer (5 presets + Off + a custom `TextInput` + chime toggle = 8 decisions),
Breathe (2 patterns + sync toggle + evidence link), Volume guide (nursery-safe toggle), Mixes
(save/load/delete), Paywall (3 actions). Fully expanded, the mixer holds **15 sliders** and 3 binaural
chips.

**44 targets before the first note plays.** For comparison, the thing the user came to do is one target.

### The QA checklist claim, verified

> "opens on a free preset, not a wall of padlocks"

**Half true, and the false half is the important one.**

*True:* on first run `read(KEYS.lastMix, null)` is null, so `restoreSession()` falls through to
`applyPreset('rainfall', { silent: true })`. Rainfall is rain + pink. Both free. `silent: true` suppresses
the paywall. The audio claim holds exactly as `App.tsx:54-59` intends.

*False:* the **screen** is a wall of padlocks. `FREE_SOUNDS` has 4 of 11 sounds, so:

- **7 of 11 layer cards are locked** — thunder, wind, fire, crickets, white, binaural, deeppulse. Each
  renders a `LockIcon` **and** a "LOCKED" pill, at `styles.locked = { opacity: 0.72 }`.
- **7 of 9 preset chips carry a lock glyph** — everything except Rainfall and Tide.

That is **14 locked objects and 21 lock signifiers in one scroll**, plus a "Premium" button in the
header and an ad banner. First run opens on a free preset *inside* a wall of padlocks.

### The finding I did not expect: for a free user, 7 of the 9 presets are ruins

`applyPreset` (`PresetRow.tsx:54-80`) applies only unlocked layers and then opens the paywall on a 260 ms
delay. Traced against `FREE_SOUNDS`, here is what a free user **actually hears** per chip:

| Chip | Designed as | What a free user gets |
|---|---|---|
| Rainfall | rain .72 + pink .30 | as designed |
| Tide | ocean .78 + brown .34 | as designed |
| Moonrise | brown + crickets + wind | **brown alone** + paywall |
| Rainy Cabin | rain + thunder + wind + fire | **rain alone** + paywall |
| Ocean Night | ocean + wind + crickets | **ocean alone** + paywall |
| Deep Space | brown + binaural + wind | **brown alone** + paywall |
| Campfire | fire + crickets + wind | **nothing changes at all** + paywall |
| Focus Flow | pink + binaural(10 Hz) + rain | pink + rain + paywall |
| Slow Wave | pink + deeppulse + rain | pink + rain + paywall |

Three consequences, all from the code:

1. **Campfire is a dead tap.** All three of its layers are locked, so `Object.keys(layers).length` is 0,
   `engine.applyMix` is skipped by design (the comment says "do not wipe what is already playing"), and
   the previous mix keeps playing. The scene changes to embers, a paywall appears, and the sound is
   unchanged. The user tapped "Campfire" and got rain.
2. **Focus Flow and Slow Wave collapse into each other.** Both become pink + rain at almost identical
   levels (.42/.22 vs .34/.20). Two chips, one sound, two paywalls.
3. **Rainy Cabin is a strictly worse Rainfall** — rain alone versus rain + pink — and it charges a
   paywall interrupt for the privilege.

A padlock at least tells the truth. A preset that silently degrades into a worse version of a preset the
user already has, and then interrupts them, is worse than a padlock. `(reasoned, not measured)`

### A claim defect that goes to the Research Lead

`PaywallSheet.tsx:251-254` and `team/README.md` standing decision 4 both say the free four are **"the
four with the strongest evidence behind them."** `src/data/evidence.ts` disagrees with itself:

- `BADGE.STRONG`: rain, ocean, pink, **fire**
- `BADGE.MODERATE`: thunder, wind, crickets, **brown**, white

So of the four `Strong` layers, **one (Campfire) is paid**, and one of the free four (Brown) is
`Moderate`. The sentence is a health-adjacent evidence claim printed on the paywall, and the app's own
data file contradicts it. Two ways out, both for the CEO and the Research Lead, not for me:

- **(a) Fix the copy.** e.g. "Rain, Ocean and Pink noise are our Strong-evidence layers and are free
  forever, with Brown noise alongside them." Safe, costs nothing, ships tonight.
- **(b) Make Campfire free.** The binding constraint is "the four free layers stay free", not "only four
  are free". Making fire free would make the original sentence true, and fire is the layer with the most
  vivid demo value (`COPY.fire`: "in the study, silent fire did nothing — the sound is the effect").
  This is a revenue decision and I am flagging it, not making it.

I recommend (a) now and (b) as a real argument worth the CEO's time.

---

## 2. The simplification proposal, before → after

Ranked by impact. Every one names the screen, the change, the reason, and the cost. None of them deletes
a feature; all but P3 are pure relocation, which is what the reframing in §0 buys us.

### P1 — `WelcomeScreen.tsx`: make the tap start the sound

**Before.** Tap the meadow → 660 ms of dip → a silent mixer of 44 targets → hunt for Play.
**After.** The tap starts the default free preset. The hint reads "Tap to start Rainfall" instead of
"Tap to begin", so the app says what it is about to do. The mixer is revealed with rain already playing.
Second change: on launches after the first, the welcome screen becomes a ~400 ms brand dip that does not
require a tap, gated on `KEYS.seenIntro` (already in the store, currently read by only one call site).

**Reason.** Our "aha" is *hearing it*. Superwall's read of 100M+ paywall opens is that the highest
converting flows fire "shortly after" the product's aha moment
(https://superwall.com/blog/what-100-million-paywall-views-taught-us-about-user-intent). Ours is
currently behind an unlabelled second tap, and every night thereafter behind a toll gate.

**Cost.** None to the audio contract — `UI-WIRING.md §4` says "never touches audio before a gesture",
and the `Pressable` tap *is* the gesture, which is exactly what an AudioContext needs. Real cost: someone
who opened the app only to change the timer now gets sound for a second. Mitigated by the honest hint
copy. Second real cost: we lose the full-screen Moonrise moment on repeat launches, which is genuinely
beautiful — hence the 400 ms dip rather than deleting it.

### P2 — `MixerScreen.tsx`: put Layers one layer down

**Before.** 11 always-expanded cards in 3 groups, each with a name, a prose note, a badge, a body line
and an info dot, 7 of them padlocked — all of it above the fold-and-a-half.
**After.** The arrival screen is: scene, preset row, the **active sleepscape card**, master volume,
transport. "Layers" collapses to one row — `Adjust the layers · 2 on` — that expands in place or opens a
sheet. The 11 cards inside are **completely unchanged**. Reduce-motion moves into the same disclosure.

**Reason.** This is Lead 1's progressive disclosure, applied to the one block that is 60% of the screen.
The mixer is the *expert* surface; it is currently also the *arrival* surface, and those want opposite
densities. Adapty's 2026 paywall write-up makes the general point in the monetisation context — a
cluttered comparison creates analysis paralysis (https://adapty.io/blog/high-performing-paywall-2026/,
13 Mar 2026); the same is true of a mixer.

**Cost.** One extra tap for a returning power user who wants to fine-tune. I think that is clearly the
right trade, but it is a real regression for exactly the user who likes us most, and it should be
measured the moment we have anyone to measure. `(reasoned, not measured)`

### P3 — `PresetRow.tsx`: stop shipping ruins, and stop the ambush modal

Two changes, and this is the one place I go further than "do not delete features", because what is being
disclosed here is not a feature — it is a broken state.

**(a) Never auto-open the paywall on a preset tap.** Delete the
`setTimeout(() => openPaywall(...), 260)` in `applyPreset`. The note card **already** renders
`Unlock the missing layer(s)` via `LinkButton` when `activeLocked.length` — the non-modal offer exists,
works, and is in the right place. The modal is redundant with it.

**(b) Label a locked preset with what the user will actually get.** Replace the lock glyph with honest
text on the chip or in the note: `Rainy Cabin · you'll hear Rain`. And Campfire, which produces *zero*
audio change for a free user, must not be tappable into a no-op — either it says "Campfire needs Fire,
Crickets and Wind" before the tap, or it does not sit in the free user's row at all.

**Reason.** A modal 260 ms after a tap the user did not associate with buying anything is the most
disliked pattern in this category, and we fire it seven times in nine. The honest label converts better
than the glyph because it states the gap concretely instead of just refusing. `(reasoned, not measured)`

**Cost.** We lose up to 7 automatic paywall impressions per session. That is the point, and I will not
pretend it is free: fewer impressions is fewer chances. My argument is that a paywall the user
*summoned* converts better than one that ambushed them, and that day-2 retention is worth more to us
than impression count at zero users. This is exactly where the Growth Lead and I may disagree, and I
would rather the CEO rule on it than that we split the difference.

### P4 — `LayerCard.tsx`: the padlock. See §3. This is the headline.

### P5 — `MixerScreen.tsx` header: the first thing we do is ask

**Before.** A `GhostButton` labelled "Premium", top-right, on frame one, wired to
`openPaywall({ reason: 'Every layer, every scene.' })`. Before anything has happened, before a note has
played, the app's first act is an ask.
**After.** On a first session that slot carries the differentiator instead — the badge proposition, one
tap to `openBadgeLegend`, which is the best-written screen in the app ("Most sleep apps tell you a sound
works. Quietloom tells you how well it is evidenced — including when the answer is 'not very'"). The ask
migrates into that slot from session two.

**Reason.** Value before the ask, at the granularity of a single button. **Cost:** one fewer permanent
paywall entry point; the paywall is still reachable from every locked card and every preset note.

### On "the evidence card must not become a footnote" — I want to argue the opposite way

The binding constraint is right and I am not designing around it. But I want to put on the record that
**today's design is already the footnote failure, and simplification is the fix, not the threat.**

The evidence is currently delivered as 11 info dots, 11 badge chips, 3 group prose notes, 11 card body
lines, a legend link, a preset note and a disclaimer — call it 19 prose blocks a tired person scrolls
past at 23:40. Diffuse *is* how something becomes a footnote. Maximally present and minimally read is
the worst of both.

What I want instead: **one unmissable evidence surface on the arrival screen** — the active sleepscape's
card, carrying its badge, one line of claim, and a tap through to the citation — and the other 18 living
one layer down where a curious person will actually read them. That is strictly *more* evidence
prominence per session, not less. If the Research Lead reads P2 as burying the evidence, this is the
paragraph to argue with, and I would like that argument on the record.

---

## 3. The padlock, specifically

### How it works today

- `LayerCard.tsx`: `styles.locked = { opacity: 0.72 }` on the whole card. The toggle is replaced by
  `LockIcon` at 18px in `color.ink4` (`#4b5567` — the dimmest ink token we have). A second signifier, the
  uppercase `LOCKED` pill, sits in the title row, also `ink4`. Title, badge chip and research prose all
  still render. `activate()` → `openPaywall({ lockedIds: [id] })`.
- `PresetRow.tsx`: `LockIcon` at 13px in `color.ink3`, top-right of the 54px art thumb.
- `entitlements.ts`: `isUnlocked` = in `FREE_SOUNDS` **or** premium **or** an unexpired night pass
  (`nextExpiry()` = next 11:00 local).

The card's own comment states the intent well — *"A padlock that explains what it is guarding sells
better than a padlock that just refuses."* The intent is right. The execution has five problems:

1. **It dims the thing it is trying to sell.** `opacity: 0.72` is the convention for a *disabled* control.
   These are not disabled, they are *for sale*. Desire and 72% opacity do not co-exist.
   `(reasoned, not measured)`
2. **It announces the refusal twice per card** — icon and pill — and 14 times per screen.
3. **Every locked card is a landmine.** The tap target is the whole header, and it goes to a modal.
4. **It sells an auditory product with a paragraph.** What is behind the lock is a *sound*. We describe
   it in prose about 1/f gust envelopes. Nobody has ever bought a sound by reading about it.
5. **The lock sits directly beside the evidence badge.** `Campfire · Strong · LOCKED` reads as "our
   best-evidenced sound is the one you have to pay for" — which, per §1, is literally true. For an
   evidence-led brand that is the worst possible adjacency.

### What I would do instead: "Hear it first"

**The premise nobody else in this category can use.** Standing decision 5: *zero audio files, everything
is synthesised.* So a locked layer costs us **nothing** to play. No download, no CDN, no licence, no
per-stream royalty. `engine.setLayerEnabled(id, true)` costs the same whether or not the user has paid.
The lock is a pure policy gate on a computation the phone will happily perform for free.

We are therefore the one app in the category that can let someone **hear the exact thing we are selling,
inside the mix they built, in their own bedroom, at their own bedtime** — and we currently choose to show
them a dimmed paragraph instead. That is the single largest unforced error in the app.

**The design.**

- The locked card **loses** `opacity: 0.72` and **loses** the `LOCKED` pill. It keeps its badge and its
  prose and it looks exactly as good as a free card, because it is exactly as good.
- In the toggle's place, not a padlock: a small labelled control reading **`Hear it`**.
- Tapping it turns the layer on **in the current mix, immediately, with no modal**. A quiet inline strip
  appears on that one card: *"Playing — free for the next 15 minutes."*
- When the window ends the layer fades out on the audio clock (the engine already does timed fades for
  `timer:done`), and the strip becomes the ask: **"Campfire faded out. Keep every layer →"**.

That is the ask moment: attached to a thing the user chose, heard, and then lost. It is honest — nothing
is taken that was not clearly labelled as borrowed — and it is the only form of "demonstrated value" that
means anything for a sleep product, because for us the demo *is* the product.

**Why this is not Endel's model.** Endel caps its *free tier* at ~10-minute sessions
(https://iconpolls.com/blogs/endel-review-2026-app-download-login-free-plan-lifetime-deal-pricing-user-experience-and-faqs;
a Pratt design critique calls the cutoff "a Demand that Refuses the core utility of the product unless
payment is made" — https://ixd.prattsi.org/2026/02/design-critique-endel-ios-app/. Endel's own help
page 403'd for me, so this is secondary sourcing, flagged.) That is the opposite of what I am proposing.
Our free four stay **unlimited, forever** — the audition adds a *paid* layer temporarily on top of a
genuinely useful free tier. Endel caps the free product; we would be previewing the paid one. Strictly
friendlier, and it is a marketing line we can say out loud.

**Costs, stated honestly.**

- **It undercuts the rewarded-ad funnel.** Someone who can audition may not watch the video. Per
  `BUSINESS.md` the ad line is $0.003–$0.02 ARPDAU; a subscriber is two orders of magnitude more. I
  believe the audition is upstream of the subscription and therefore worth it, but this is a genuine
  trade and the Growth Lead should contest it if they see it differently. `(reasoned, not measured)`
- **It touches a frozen contract.** `Entitlements` is frozen. Per `team/README.md` "adding to them is
  fine", so `Entitlements.startAudition(id)` / `isAuditioning(id)` would be additive — but
  **`isUnlocked()` semantics must not change**, or the night pass, the restore path and
  `restoreSession()`'s enabled-layer filter all shift underneath us. The mixer must ask a *new* question.
  Flagging this loudly because it is precisely the kind of change that gets made quietly.
- **Abuse: relaunch to re-audition.** Mitigate with one used-timestamp per layer per day, the same shape
  as `KEYS.lastInterstitialDay`. Worth saying plainly: the marginal cost of someone hearing synthesised
  fire is **zero**, so a leaky audition is a marketing expense, not a loss. Do not over-engineer it.
- **It is the largest engineering item in this proposal.** P1, P3 and P5 are hours. This is days.

---

## 4. The paywall's shape

### What today's sheet is

`PaywallSheet.tsx`, a fully soft bottom sheet — four dismissal paths (scrim tap, drag past
`DISMISS_PX = 96`, close X, Android back via `closeTopLayer`). Header "Unlock every layer" / eyebrow
"Four layers are always free". Then, in this order:

1. **"Unlock tonight"** — watch a rewarded video — priced **"Free"**. Styled with
   `borderColor: accent.accentSoft` **and** `backgroundColor: accent.accentSoft`.
2. **"Premium forever"** — **$4.99** (`Billing.PRICE_DISPLAY`). Styled as a plain `cardQuiet` card.
3. Status line, the free-four footer, "Restore a previous purchase".

### Five things wrong with it, in order of cost

**(1) The visual hierarchy sells the $0 option.** The rewarded-ad card is first in reading order *and*
accent-filled; the paying option is a quiet grey box below it. Every visit to this sheet is designed to
end in an ad view. This is a pure styling defect in lines 216–230, it costs nothing to fix, and it is the
highest-value single edit on the surface. **To be explicit: I am not proposing to remove the rewarded
unlock. I am proposing that we stop styling it as the recommended action.**

**(2) There is no live purchase path at all.** `runPurchase` checks `Billing.isAvailable()`, which is
`connected`, which is `false` until real billing is wired (`billing.ts` is a stub with a TODO). So today
**100% of paywall visits end in an ad or the string "Coming soon — the free unlock works tonight."** It
is not a paywall yet; it is an ad funnel with a decorative price. Any conversion discussion has to start
there.

**(3) Single price, no anchor.** "$4.99" next to "Free" is the weakest possible presentation. Adapty's
2026 benchmarks put pre-selecting an annual plan against a decoy monthly at **69–74% annual selection**,
worth **50%+ on 12-month LTV** versus a monthly-default paywall
(https://adapty.io/state-of-in-app-subscriptions/, and the design write-up at
https://adapty.io/blog/high-performing-paywall-2026/, 13 Mar 2026).

**(4) One page doing four jobs.** Value, objection-handling, pricing and the transaction are all on one
sheet. Superwall, over "just over 40 million paywall opens from February to May 2026", measured
**multi-page paywalls at 12.41% vs 9.07% single-page — a 37% improvement** — attributing it to reduced
cognitive load and to showing value before price
(https://superwall.com/blog/new-postmulti-page-onboarding-paywalls-convert-37-better-than-single-page-heres-why,
26 May 2026).

**(5) No demonstration.** The sheet lists what you cannot have. Nothing on it makes a sound. See §3 — for
us this is fixable in a way it is not for anyone else.

### What the research says about shape, and what I take from it

| Finding | Source |
|---|---|
| Day-35 install-to-paid: global median **2.0%**, **Health & Fitness 2.9%** (near the top of all categories). H&F is the best-monetising category on nearly every metric: RPI **$0.48** D14 / **$0.66** D60, Year-1 RLTV **$35.64**/payer. **68% of H&F subscriptions are annual** — the most annual-skewed category. **60% of H&F paywalls offer exactly two plans**, the highest two-plan share anywhere | RevenueCat *State of Subscription Apps 2026*, 115,000+ apps / $16B+, pub. 19 Mar 2026 — https://www.revenuecat.com/state-of-subscription-apps · https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026/ |
| Hard paywall vs freemium, D35 download-to-paid **10.7% vs 2.1%**; revenue per install D60 **$3.09 vs $0.38**. **But Year-1 retention is effectively identical — 27% vs 28%** | RevenueCat 2026, as above |
| Trial-to-paid by trial length: **≤4 days 25.5% · 5–9 days 37.4% · 17–32 days 42.5%.** The market is moving the wrong way — 46.5% of apps now use ≤4-day trials. H&F trial-to-paid **37.7%**; download-to-trial **6.9%** | RevenueCat 2026, as above |
| **89.4% of all trial starts happen on install day.** 55.4% of 3-day-trial cancellations happen on Day 0 | RevenueCat, https://www.revenuecat.com/blog/engineering/android-paywall-gap/ (25 Mar 2026) |
| Install-to-paid **by paywall placement**: onboarding **+ trial 1.35%** · in-app + trial **0.89%** · onboarding, no trial **0.82%** · in-app, no trial **0.76%**. **89.4% of trial starts and 44.5% of all purchases happen on Day 0** — independently matching RevenueCat | Adapty *State of In-App Subscriptions 2026*, 16,000+ apps / 105,000+ paywalls — https://adapty.io/state-of-in-app-subscriptions/ · https://adapty.io/blog/high-performing-paywall-2026/ (13 Mar 2026) |
| Soft paywalls **convert ~50% better**; hard paywalls yield **~21% higher LTV**. (Adapty's "hard" means *no close button*; RevenueCat's means *no free tier at all* — different measurements, do not blend) | Adapty 2026, as above |
| H&F: install-to-trial **9.5%** global / **14.5%** NA; trial-to-paid **42.2%**; first renewal **67.7%** vs 59.2% all-category; install LTV **$1.21**, highest of all categories; annual **51% → 61%** of category revenue 2023–2025; high- vs low-priced annual LTV **$70 vs $17**. **Trials raise LTV in Health & Fitness** (they lower it in Productivity and Lifestyle) | Adapty, https://adapty.io/blog/health-fitness-app-subscription-benchmarks/ (27 Mar 2026) |
| Experiment win rates on LTV: **trial-structure changes 59.6%, localization 62.3%, visual/copy-only 34.6%.** Structural decisions carry ~2x the win rate of cosmetic ones | Adapty 2026, as above |
| Multi-page onboarding paywalls **12.41%** vs single-page **9.07%** (**+37%**), 40M+ paywall opens Feb–May 2026. Multi-page is still only 24% of the market | Superwall, https://superwall.com/blog/new-postmulti-page-onboarding-paywalls-convert-37-better-than-single-page-heres-why (26 May 2026) |
| **2 products = +61% conversion vs 1; 3 products = +44% over 2.** 32.3M paywall opens — *but published Nov 2022, flag as stale* | Superwall, https://superwall.com/blog/how-many-products-should-you-offer-on-your-paywall |
| Highest-converting paywalls fire shortly after the product's "aha" moment | Superwall, https://superwall.com/blog/what-100-million-paywall-views-taught-us-about-user-intent |

**Apple's requirements — these are review gates, not advice.** From Guideline 3.1.2 and the linked
subscriptions page (https://developer.apple.com/app-store/review/guidelines/ ·
https://developer.apple.com/app-store/subscriptions/), verbatim:

- *"you must provide ongoing value to the customer, and the subscription period must last at least seven
  days"*
- *"Before asking a customer to subscribe, you should clearly describe what the user will get for the
  price."*
- The sign-up screen must carry subscription name, duration, what is provided, **full renewal price**,
  and *"a way for current subscribers to sign in or restore purchases"*.
- **The prominence rule, which is what actually gets apps rejected:** *"In the purchase flow, the amount
  that will be billed must be the most prominent pricing element in the layout... While you may also
  present a breakdown price that the annual amount is equivalent to... these additional elements should
  be displayed in a subordinate position and size to the annual price."* The "$3.33/mo, billed annually"
  pattern that dominates wellness paywalls is only compliant if the **$39.99 total is visually dominant**.
  Design accordingly from the start rather than after a rejection.
- **Grandfathering is mandated, not optional:** *"If you are changing your existing app to a
  subscription-based business model, you should not take away the primary functionality existing users
  have already paid for."* And coexistence is explicitly allowed: *"Subscriptions may be offered
  alongside à la carte offerings."* This settles the $4.99 question — see the end of this section.

**Where I have to correct myself, and where the data cuts against us.** I expected the freemium case to
be clean. It is not. RevenueCat's hard-paywall cohort converts **5x** better and earns **8x** the revenue
per install, **and retains the same** — 27% vs 28% Year-1. The usual defence ("hard paywalls buy junk
users") is simply not supported by that dataset. So I am not going to claim freemium wins on the numbers,
because it doesn't. I still hold the freemium position, on two grounds that are not conversion grounds:
standing decision 4 settles it, and a hard paywall on a product opened at 23:40 by someone who cannot
sleep is a bad thing to build. That is a values argument and I would rather make it honestly than dress
it up as a growth argument.

**Note also Apple's *"must provide ongoing value"*.** That is a review requirement and it lands squarely
on the CEO's open question of what recurs. Today, nothing does: every paid layer is a static synthesis
routine that ships in the binary. My design-side answer, offered and then deferred to Growth: what can
honestly recur is **new scenes and new sleepscapes on a cadence** — the Skia renderer is the moat and is
the only part of the product that can credibly ship something new every month — **and a maintained
evidence library**. Both are things we would actually do. Neither is a feature we can invent on a
paywall. Portal, notably, has landed on exactly this answer (§5).

### Lead 3 is wrong, and this is the most useful thing in my entry

Lead 3 says: *"the honest ask moment is plausibly session two or day two, not minute one."* The 2026 data
says no, and it says it from two independent datasets that agree to the decimal:

- **89.4% of all trial starts happen on install day** (RevenueCat *and* Adapty, separately measured).
- **44.5% of all purchases happen on Day 0** (Adapty).
- Adapty's measured placement table puts **onboarding + trial at 1.35%** against **in-app + trial at
  0.89%** — the *earlier* placement wins by ~50%.

A user who does not convert in session one overwhelmingly never comes back to convert. A day-two ask is
an ask most people never see.

**But the principle inside Lead 3 survives intact, and it is the more important half.** What the data
supports is not "ask early" — it is **value before the ask, *within* the first session**. That is exactly
what Superwall's multi-page result measures (+37% from splitting value, expectations and price across
screens rather than deferring anything). The "demonstrate value first" instinct is right. The "session
two" tactic is what the evidence rejects.

So: **the audition in §3 is the correct shape and Lead 3's timing is not.** A 15-minute audition that
starts in minute two and asks in minute seventeen is *still Day 0*. It gets both properties at once —
demonstrated value, and an ask that lands while the user is still there. If we had built to Lead 3's
timing we would have shipped a paywall that ~89% of our prospects never reach.

One thing I could not verify and nobody should cite: a widely-repeated figure attributed to Adapty
claiming *"31% trial starts on an immediate hard paywall vs 65% after a value moment."* It appears only
on aggregators, is absent from Adapty's primary pages, and points the opposite way from Adapty's own
published placement table. It is the number most likely to be quoted at us in support of Lead 3, and it
does not hold up. `(unverified — do not use)`

### The shape I would build

1. **Restyle the two options today.** Paid option first and accent-filled; rewarded unlock second, plain,
   still perfectly usable, still honest, still governed by the grace rule. One file, one afternoon, and
   it is the highest ratio of value to effort anywhere in this entry.
2. **Keep exactly two plans.** We already have two options, which is right: Superwall measured 2 products
   at **+61%** over 1, and **60% of Health & Fitness paywalls ship exactly two** — the highest two-plan
   share of any category. Our defect is styling, not structure.
3. **Make it multi-page** once there is a subscription: page 1 value (with the audition from §3 audibly
   playing underneath it), page 2 the plans, page 3 the transaction. +37% on 40M opens is the
   best-evidenced paywall finding of 2026 and it is a layout change, not a product change.
4. **Annual pre-selected, and obey Apple's prominence rule from the first mockup.** H&F is the most
   annual-skewed category in the market (68%). But the **full annual price must be the largest pricing
   element on the screen**, with any per-month equivalence subordinate in size and position. Getting this
   wrong is a rejection, and it is much cheaper to design right than to fix after review.
5. **If there is a trial, make it 7 days minimum — and argue for longer.** Trial-to-paid runs **25.5% at
   ≤4 days vs 42.5% at 17–32 days**, and trials specifically *raise* LTV in Health & Fitness where they
   lower it elsewhere. The market is drifting to 3-day trials and the market is wrong. For a sleep
   product the case is even stronger than the average: our value takes *nights*, and a 3-day trial
   straddles a weekend badly.
6. **Keep it soft.** Four dismissal paths stay. No blocking paywall on a sleep surface, ever.
7. **Fire it when the audition ends, not on a preset tap.** That is the ask moment, and per the Lead 3
   discussion above it is **still Day 0** — which is the whole point. It is self-selecting for intent
   (the user chose that layer), it arrives after demonstrated value, and it arrives while the user is
   still in the session where ~89% of all conversions happen.
8. **Copy goes to the Research Lead**, including the §1 claim defect, which is live on the sheet today.

I will not propose a price. That is the Growth Lead's call and `BUSINESS.md` days 11–18 already sketches
$2.99/mo or $19.99/yr against a kept $4.99 lifetime. Two design notes on it:

- **The $4.99 lifetime buyer must never see a downgrade — and this is not a courtesy, it is Apple's
  rule.** Guideline 3.1.2(a): *"you should not take away the primary functionality existing users have
  already paid for."* `PaywallSheet` already branches on `Entitlements.isPremium()` to "Premium is active
  / You have every sound, every scene, forever." That promise has to survive a subscription launch
  verbatim. Coexistence is explicitly permitted — *"Subscriptions may be offered alongside à la carte
  offerings"* — so the frozen `quietloom_premium_forever` contract is not in anyone's way.
- Lifetime priced against annual sits between **2.1x and 11.5x** in the market; the closest comps are
  Calm ($79/yr vs $399 lifetime, 5.0x) and Waking Up (11.5x). Ours would currently be *below* a single
  year of any competitor. Growth's call, but worth seeing before the number is set.

---

## 5. The category check

Installing was not possible from here, so everything below is from current published sources, with the
gaps stated rather than filled in.

**Sonora** — and the first finding is that **there are two different apps called Sonora**, which is worth
knowing before anyone cites "Sonora" in a meeting:

- *Sonora — Sleep & Focus Sounds*, by Sonoraa Audio Lab (sonoraa.com), is the one close to our
  positioning: a **sound mixer** with nature sounds, white noise, binaural beats and isochronic tones,
  adjustable frequency bands, animated soundscapes. Freemium with a "premium library". IAPs listed as
  **$6.99/month and $39.99/year**. v1.25.0 added **"Science Explainers" — interactive guides on binaural
  beats, colored noise and sleep conditioning** — and v2.3.0 added **"Soundpath: guided discovery of our
  features"** as onboarding. Updated within the last few days.
  https://apps.apple.com/us/app/sonora-sleep-focus-sounds/id6742157763 · https://sonoraa.com/
  Their landing page's positioning line is *"Why pay 3x more for big corporate apps like Calm or
  Headspace?"* — they compete on price, not on evidence. Their science claims are **generic and
  uncited**: "psychoacoustic principles and research", no links to papers. Their most prominent proof is
  **"4.8, 1,000+ reviews"**. **This is the whole opening for us.** Our nearest competitor has arrived at
  the same idea — explain the science — and executed it as marketing copy. `evidence.ts` with real
  citations, badges including "Traditional = no direct controlled evidence", and Riedy 2021 published as
  counter-evidence is a thing they have not done and would find hard to start doing.
- *sonora.com* is a different product — AI voice-biomarker sound healing, flow "Welcome → Voice Analysis
  → Experiences → Sound Player", **100% free, no IAP, no paywall**, science claimed as "decades of
  peer-reviewed research" with no citations on the homepage. https://sonora.com/
  **I could not determine what is on either Sonora's literal first screen after install** beyond the flow
  names above. Stated as a gap rather than guessed.

**Endel** — free tier is the four classic soundscapes (Focus, Sleep, Relax, Move), with sessions capped
at roughly 10 minutes before an upgrade prompt (secondary sources only; the Endel help page 403'd —
https://iconpolls.com/blogs/endel-review-2026-app-download-login-free-plan-lifetime-deal-pricing-user-experience-and-faqs,
https://ixd.prattsi.org/2026/02/design-critique-endel-ios-app/). The App Store listing shows a **very
wide IAP ladder — 1 Month at $2.99 / $7.49 / $19.99, 12 Months at $34.99 / $59.99 / $119.99, Lifetime
$124.99** — i.e. heavy price testing across cohorts, which is itself the finding
(https://apps.apple.com/us/app/endel-focus-sleep-sounds/id1346247457). Trial requires entering payment
details up front, which is the single most complained-about thing about their onboarding. "Backed by
science", no citations in the listing.

**Portal** — 6 free portals on install, then **$9.99/month, $49.99/year, or $249.99 lifetime** with a
7-day trial; Premium is framed as unlimited access to a **100+ library that is regularly updated**
(https://portal.app/, https://apps.apple.com/us/app/portal-escape-into-nature/id1436994560). Worth noting
for §4: Portal's recurring value is explicitly *new content on a cadence*, which is the same answer I
arrived at independently.

**Calm** — onboarding is a **4-step quiz** ("What brings you here?" → sleep / anxiety / focus /
self-improvement, experience level, session length, reminder time) and steers hard to the Premium trial,
with free content easy to miss. **$69.99/year or $14.99/month**
(https://carepaths.com/calm-app-pricing/, https://www.autonomous.ai/ourblog/calm-app-review — both
secondary; I could not open a Calm-owned pricing page).

**BetterSleep** — **$59.99/year**, periodic lifetime around $249; free tier is roughly **20 sounds** plus
a basic sleep timer; the full library needs a subscription
(https://www.bettersleep.com/support/en/articles/5371738-how-much-does-bettersleep-cost,
https://intercom.help/BetterSleep/en/articles/15602562-is-bettersleep-free).

**What the category actually tells us.** Three things:

1. **Everyone asks a lot before playing anything.** Calm asks four questions; Endel asks for a card. Our
   one-tap welcome is already better than the category — we then squander it on a silent mixer (P1).
2. **Nobody cites anything.** Every one of these apps says "backed by science" and none of them links a
   paper. Our evidence card is not a nice-to-have differentiator, it is the *only* structural one we
   have, and it is currently spread so thin that it reads as texture rather than as a claim (§2, closing
   argument).
3. **Our $4.99 is far below the category floor** — against $39.99–$69.99/year and $124.99–$249.99
   lifetime. Adapty's H&F data puts high-priced annual LTV at **$70 vs $17** for low-priced. Not my call,
   but the Growth Lead should see that we are currently priced at roughly a tenth of the field, and
   Adapty's own note that **9 in 10 subscriptions sell at full price** suggests the discount instinct is
   not where the money is.

---

## 6. If I could make only one change

**Replace the padlock with an audition. `LayerCard.tsx` — "Hear it", 15 minutes, then it fades and asks.**

Everything in this task funnels into that one surface. It is the simplification, because seven dimmed,
double-labelled, modal-triggering dead cards become seven live ones and the screen stops reading as a
sales page. It is the conversion work, because it is the only way a sleep app can demonstrate value
before the ask — the demo *is* the product, and we are the only app in the category that can give it away
for free, because standing decision 5 means it costs us nothing. And it is the ask moment Lead 3 asked us
to name and defend: **the first time a layer you chose and heard fades out.**

If the answer is that the audition is too large for now: the fallback that ships tonight is P3(a) —
**delete the 260 ms auto-paywall in `applyPreset`** — plus the restyle in §4(1) so the paid option stops
being the visually secondary one. Those are two small edits in two files and they remove the app's most
irritating behaviour and its most self-defeating one.

The audition also survives the one piece of research that surprised me. I went looking for support for
Lead 3's "ask on day two" and found the opposite — 89.4% of trial starts happen on install day. A
15-minute audition beginning in minute two and asking in minute seventeen demonstrates value *and* lands
on Day 0. It is the only proposal here that satisfies both.

**Disagreements I want ruled on, not split:**

1. **Against Lead 3 (the CEO's own).** "Session two or day two" is contradicted by two independent 2026
   datasets. The ask belongs in session one, *after* demonstrated value, not on day two. The principle
   inside Lead 3 is right; the timing is not. This is the highest-value correction in my entry and I
   would rather be told I am wrong than have it pass unnoticed.
2. **Against Growth.** Removing seven automatic paywall impressions per session (P3a) trades impressions
   for intent. I think that is right at zero users; I accept it is arguable.
3. **Against Research.** Whether P2's progressive disclosure of the layer cards buries the evidence or
   finally makes it land. My argument is the closing paragraph of §2 and I hold it strongly: 19 prose
   blocks nobody reads is already the footnote failure.
4. **The §1 claim defect** is live on the paywall today, is Research's call, and comes with a real
   business option ("make Campfire free") rather than only a copy fix.

**Sourcing gaps, stated rather than filled.** Apple's HIG in-app-purchase page is client-side rendered
and would not fetch across several attempts — the App Store Review Guidelines and the subscriptions page
did, and those carry the enforceable requirements, so nothing above rests on the HIG. Endel's own
free-tier help page returned 403; its 10-minute cap is secondary-sourced and flagged as such. I could not
establish what is on either Sonora's literal first screen after install. Material Design 3 has no
progressive-disclosure guidance I could find, so I have not cited it. Nothing in this entry is measured
on Quietloom, because Quietloom has no users.

Next: nothing from me until the CEO routes this. No code, no files touched but this log.



### Research Lead — finished 21:31:26

Did: read `CLAUDE.md`, `team/README.md`, `team/research-lead.md`, `tasks/simpler.md`, `research.md`,
`src/data/evidence.ts`, `EvidenceSheet.tsx`, `PaywallSheet.tsx` and the `BUSINESS.md` store copy, then
swept every user-facing claim string in `src/**` and re-read each load-bearing one myself before
ruling on it. Checked the live literature for supersession and opened every source I cite.

Changed: `tasks/simpler.md` only. No code, no docs, no `evidence.ts`, no `research.md` — verified with
`git status`. (Unrelated to me, and flagging it for the CEO rather than touching it: `package.json`,
`package-lock.json`, `vitest.config.ts`, `vitest.bundle.config.ts`, `test/`, `__mocks__/` and
`tasks/tests.md` all appeared in the working tree during this wave, which was declared no-code.)

The five rulings that matter:

1. **Pink noise drops Strong to Moderate.** Basner 2026 (SLEEP 49(5):zsag001, n = 25, 7-night
   randomised crossover PSG) found pink noise at 50 dB cut REM sleep by 18.6 minutes versus quiet
   (p = .0003). Confirmed by the accompanying editorial and not rescued by the one pilot pointing the
   other way. Masking for sleep onset survives; "the noise with the best evidence" does not. The
   45-minute timer default is vindicated — we already refuse to do the thing that was shown to cost REM.
2. **The paywall states a false evidence ranking at the moment of sale** (D1). Campfire is Strong and
   locked; brown is Moderate and free. Three files state this claim three different ways and none is
   accurate. Fix the sentence, not necessarily the tier.
3. **A 10 Hz alpha binaural beat ships with a "For work, not sleep" benefit and no source anywhere**
   (D6). This is the invented-parameter failure mode my charter exists to prevent, on a paid layer.
4. **Deep Pulse cannot hold an Emerging badge behind a price** (D5), and "slow-wave enhancement
   protocol" is shipping in three places despite an explicit ban in `HANDOFF.md` and the QA checklist
   (D4). The qualifier is accurate but does not survive truncation, and paywalls truncate.
5. **Simplification veto:** badges, source links, per-claim counter-evidence, the two dangerous-layer
   caveats and the medical-device footer are load-bearing. Detail prose, inlined badge meanings and
   the eyebrow are freely reducible. The trap is ocean — its Strong badge is earned by the
   breathe-with-it instruction, so deferring that instruction demotes the badge.

Nine claim rules (R1–R9) for the paywall are in section 2. The one that catches most problems
mechanically: **the paid surface carries the same or more hedging than the free surface, never less.**

On the subscription: a recurring-content promise costs this role roughly 50–100 hours a year and will
produce mostly Traditional badges, which is a churn argument that happens to be true. My alternative —
offered, not insisted on — is that the recurring deliverable be the bibliography itself.

Next: nothing from me until the CEO rules. I have no queue and no files to change. Available to review
the Designer's and Growth Lead's proposals against R1–R9 the moment they land.

### Product Designer — addendum 21:31:57 (read against the Research Lead's entry)

I filed at 21:25:51 without having read the Research Lead, who filed while I was working. Having now
read them, three interactions the CEO should not have to find by diffing two long entries. Nothing below
changes my proposal; two things strengthen it and one needs a ruling.

**1. Their pink-noise veto makes my §1 claim defect worse, and changes its fix.**
They rule pink **Strong → Moderate** on Basner 2026. My §1 showed that "the four with the strongest
evidence" is already false because Campfire is `Strong` and paid while Brown is `Moderate` and free.
After their demotion the free four contain **only two** `Strong` layers (rain, ocean) out of a
`Strong` set of three (rain, ocean, **fire**). The sentence on `PaywallSheet.tsx:251-254` and in
`team/README.md` standing decision 4 goes from *arguably loose* to *plainly wrong*, and the only paid
layer in the entire `Strong` tier is Campfire. That materially strengthens my option (b): **making
Campfire free would restore the claim's truth in one move**, and it is permitted by the letter of the
constraint ("the four free layers stay free" ≠ "only four are free"). I now hold (b) as the better
answer rather than the interesting one. Still a CEO revenue call, not mine.

**2. Their refusal #6 does not hit my recurring-value answer, and the distinction is load-bearing.**
They refuse *"new sounds every month"* until the Traditional-badge policy is ruled, because the badge
system cannot absorb twelve unevidenced drops. Agreed, and I would not propose it. My §4 answer was
**new scenes and new sleepscapes**, which is a different object:

- A **scene** is visual and carries *no evidence claim at all* — the Research Lead has already bound us
  to "nothing anywhere may imply that looking at a screen helps you sleep; the scenes are pleasant, and
  that is the entire claim" (`WelcomeScreen.tsx:9-12`). A monthly scene therefore adds zero load to the
  badge system by construction.
- A **sleepscape** is a preset — a new *arrangement of already-badged layers*. It makes no new claim
  either; it inherits ones already ruled on.

So "a new scene and a new sleepscape each month" is a recurring-value promise that is compatible with
their veto, where "a new sound each month" is not. Given Apple mandates *"ongoing value"* on 3.1.2 for
any auto-renewable subscription, this may be the only recurring promise available to us that Research
can sign. Worth the CEO ruling on explicitly, because it is the difference between having a subscription
we can ship and not.

**3. We converged independently on the padlock, which is the strongest signal in this wave.**
They wrote, before reading me: *"the evidence card is the best conversion asset in the app, so it should
be more visible while locked, not less. A padlock that says 'Locked' and nothing else is simultaneously
the most overwhelming and the least persuasive thing we could put there."* I reached the same place from
the design side in §3 — `opacity: 0.72` plus a doubled refusal signifier is the worst of both. Two roles,
separately, landed on the same surface as the highest-leverage one. My "Hear it" audition satisfies their
requirement directly: the locked card **keeps** its badge and its citation, **loses** the dimming and the
`LOCKED` pill, and gains the one thing a citation cannot deliver — the sound itself.

**Where I may still trip their refusal #4, and I would rather raise it than discover it.** They refuse
"any simplification that removes badges from the point of choice." My P2 moves the eleven layer cards
one layer down. My reading is that this is compliant — the cards are *unchanged*, badges included, and
the point of choice for a layer is the card itself — and that the arrival screen gains a *more*
prominent evidence surface on the active sleepscape. But if they read "point of choice" as "the first
screen", P2 needs rework, and I would rather they say so now than after someone builds it. The preset
chips, which carry no badge today and are a genuine point of choice, are the sharper version of their
objection and neither of us has proposed a fix for that.

Next: still nothing from me until the CEO routes this. No code, no files touched but this log.



### Research Lead — ruling 21:39 (continuation: connection dropped mid-file; my sections 1-5 above stand unchanged)

Answering the CEO's routing of QA's Deep Pulse finding, and the three questions the Product Designer
raised against my entry. Sections 1 through 5 above are unaffected by anything below.

## A. Deep Pulse: the three sites QA flagged, and the one it missed

**Site 1 — `src/data/evidence.ts:128`**, the `claim` field, top of the evidence card:
> `'Rhythmic pink-noise pulses modelled on a slow-wave enhancement protocol. Experimental.'`

**Site 2 — `src/data/presets.ts:104`**, the Slow Wave preset note:
> `'Pink-noise pulses at 0.8 Hz, modelled on a slow-wave enhancement protocol. Experimental — see the evidence card.'`

**Site 3 — `README.md:8`**:
> `'...binaural beats and the slow-wave pulse are all generated from oscillators, filtered noise and a 1/f amplitude envelope...'`

**Ruling on site 3: QA over-read this one, and I decline to veto it.** `README.md` is a developer setup
document, not a claim surface — no user ever sees it. And the string does not describe Deep Pulse as
slow-wave *enhancement*: "the slow-wave pulse" names the sound, in a list of things the synthesis engine
generates, in a sentence about oscillators and filter topology. There is no enhancement verb and no
claim. I recommend changing it to "the Deep Pulse layer" for naming consistency, because the layer is
called Deep Pulse everywhere else, but that is tidiness and I will not dress it up as a policy breach.
Saying so plainly matters: a veto that fires on every grep hit is a veto nobody routes around me, and
this role is worth nothing the moment it becomes a string filter.

**Ruling on sites 1 and 2: change them, but not for the reason the grep implies.** Both sentences are
*true*. The Papalambros protocol genuinely is a slow-wave enhancement protocol, both strings say
"modelled on", and neither asserts that Deep Pulse enhances anything. On a literal reading of the
standing decision, both comply — which is presumably how they passed review three times. I am changing
them on a stronger and different ground: **they put the qualifier last, and every surface money touches
truncates.**

**The site QA missed, and it is the one that matters most: `BUSINESS.md:631-632`** — the paste-ready
Play Store listing:
> `'· Deep Pulse: rhythmic pink-noise pulses modelled on a slow-wave enhancement protocol,`
> `  clearly labelled Experimental'`

This is the most dangerous instance in the product, for four reasons that none of the code sites share.
(i) My charter names this surface explicitly — "not in the app, **not in the store listing**, not in a
launch post." (ii) It is the only one **published outside our control**: once it is in Play Console it is
indexed, scraped and quoted, and we cannot patch a screenshot someone took. (iii) Play truncates
descriptions in search results and on the listing card, and the cut lands almost exactly on
*"...modelled on a slow-wave enhancement..."*, with the qualifier "clearly labelled Experimental"
stranded eleven words past the fold. (iv) It is the copy a Play policy reviewer reads. QA greps `src/`;
the highest-consequence claim surface in this company contains no code at all. That gap is the finding,
not the string.

**A fifth site nobody flagged, and it is worse than three of the four: `presets.ts:102`,**
`name: 'Slow Wave'`. A chip label is the most excerptable and least qualifiable string in the entire
product — it cannot carry a caveat, it cannot be truncated because it is already two words, and it names
an *outcome*. "Slow Wave" as the name of a paid preset is a stronger implicit claim than any sentence
QA flagged. **Rename it.**

Also `LayerCard.tsx:37`, softer but the same shape: `'Pink-noise pulses near 0.8 Hz, modelled on a
slow-wave protocol. Experimental.'`

### Replacement copy — I own the wording, so here it is exactly

The principle, which is what I actually want adopted: **front-load the caveat, name the mechanism we
lack, never let "slow-wave" sit adjacent to an enhancement verb, and make the first 60 characters
honest standing alone.**

1. `evidence.ts:128` (`claim`):
   `'Experimental. Rhythmic pink-noise pulses at about 0.8 Hz, open-loop — the rhythm of a tested protocol without the EEG targeting that made it work.'`

2. `presets.ts:104` (preset note):
   `'Experimental. Pink-noise pulses at 0.8 Hz, open-loop — we cannot phase-lock to your sleep without EEG. See the evidence card.'`

3. `BUSINESS.md:631-632` (store listing bullet):
   `'· Deep Pulse (Experimental): rhythmic pink-noise pulses at about 0.8 Hz, open-loop. The study behind it used live EEG to time every pulse to a brain wave; we have no EEG, so we run the rhythm and say so.'`

4. `LayerCard.tsx:37` (`COPY.deeppulse`):
   `'Experimental. Pink-noise pulses near 0.8 Hz, open-loop — the rhythm without the EEG targeting.'`

5. `presets.ts:102` (preset name): **"Slow Wave" becomes "Deep Pulse"**, matching the layer. If a
   distinct name is wanted: "Pulse Night". Not "Slow Wave", not "Deep Sleep", not "Delta".

**The acceptance test, which is mechanical and belongs on QA's checklist.** Cut each string at 60
characters; it must still be honest:
- `"Experimental. Rhythmic pink-noise pulses at about 0.8 Hz, op"` — passes.
- `"· Deep Pulse (Experimental): rhythmic pink-noise pulses at a"` — passes.
- `"Deep Pulse: rhythmic pink-noise pulses modelled on a slow-wa"` — **fails.** That is today's listing.

**R10 (new).** Any claim string that can reach a monetisation or store surface must remain honest when
truncated to 60 characters. Qualifiers come first, never last. This is a substring test, not a human
read, and QA should run it as one.

**R11 (new), which is the CEO's point and the reason this was routed to me.** Copy that breaches a
standing decision while the app is free becomes *a promise someone paid for* the moment it sits behind a
price. Same words, higher bar. It is why `BUSINESS.md` outranks `src/` here, and why I would fix the
store listing before the code.

## B. The paywall claim defect — veto confirmed, and the Designer's arithmetic is now the right one

`PaywallSheet.tsx:251-254` tells a user, at the moment of sale, that the free four are "the four with the
strongest evidence behind them." With pink demoted the `Strong` set is **rain, ocean, fire**. The free
four are rain, ocean, pink, brown — **two Strong and two Moderate — and the only paid layer in the entire
Strong tier is Campfire.** The sentence has gone from loose to plainly false. **Vetoed; it cannot ship as
written, and it is live today.**

**Fix (a), the copy, is mandatory and immediate** — it costs nothing and it is on a monetisation surface
right now. My replacement, which is claim-safe under either outcome and, unlike the current sentence,
does not break the next time a badge moves:

> `'Rain, Ocean, Pink noise and Brown noise are free forever. Between them they cover the two things`
> `the evidence supports best — nature sound for winding down, and steady masking for falling asleep.`
> `Every layer shows its evidence badge, free or paid.'`

No ranking, no superlative, nothing a reader can falsify with our own app. **That is the actual lesson:
the sentence broke because it hard-coded a ranking into copy. Do not replace one ranking claim with
another.** Standing decision 4 in `team/README.md` needs the same treatment for the same reason.

**Fix (b) — making Campfire free — is the CEO's revenue call and I do not need it to lift my veto.** But
since the Designer now holds it as the better answer, one piece of evidence for the file: **Lynn 2014 is
completely untouched by Basner 2026.** Different mechanism, different outcome measure, different
literature — fire's evidence is blood pressure and relaxation, not noise masking, so nothing in the 2026
noise results touches it. It is now the most robust primary study in the bibliography *and* the only
Strong layer we charge for. If the founder wants the free tier's justification to survive the next
finding rather than needing rewriting again, campfire is the layer that carries it.

## C. Pink — yes, I am demoting it. Plainly, what the evidence now supports

**Supported.** Pink noise for **sleep onset**, and for **masking intermittent noise when there is noise to
mask**. Capezuti 2022 (34 studies, 1,103 participants) still shows pink with the highest positive-outcome
rate of any auditory intervention reviewed — **81.9% versus 33% for white** — and Basner 2026 itself found
pink attenuated noise-induced arousal in the noisy conditions.

**Not supported, and now actively contradicted.** Pink noise **all night, in an already quiet room**.
Basner 2026: pink at 50 dB against quiet control cut REM by **18.6 minutes** (p = .0003).

**So what changes is narrower than "pink is out".** Pink **stays the default** and **stays free**. What
moves is the badge (Strong to Moderate) and the sentence "the noise with the best evidence"
(`evidence.ts:84`, `BUSINESS.md:605-609`, `BUSINESS.md:64-66`). **Pink-over-white survives intact** —
that comparison is what Capezuti actually measures, and it is the claim our default rests on. "Pink is
the best-evidenced sleep sound, full stop" does not survive.

**And the consequence the CEO should weigh: this strengthens standing decision 3 far more than it
weakens decision 4.** The 45-minute timer is now the best-evidenced design decision in the product. We
already refuse to do the precise thing that was just shown to cost REM, and we did it before the study
landed. That is an asset — but only if we say it first. If a reader finds Basner 2026 before we publish
it, the story is "sleep app's headline claim is four months stale." If we publish it, the story is the
one in my first section, and it is the best one available to us.

## D. The audition, against my refusal #4 — direct answer, since they asked

**It does not trip refusal #4. Approved on claim grounds, and I will say so unprompted: it is the best
answer to my own objection that anyone has proposed.** Refusal #4 protects badges at the point of choice,
the readability of the evidence card while locked, and per-claim counter-evidence. The audition
*increases* all three — it drops the dimming, keeps the badge and the citation, and adds the one thing a
citation cannot deliver. I wrote before reading them that a locked card should be more visible, not less;
this is that, built.

**But it trips R4 and D7 hard, and this is exactly the thing to fix before anyone builds it — which is
why they were right to ask now.** `LayerCard.tsx:222` gates the card body on `unlocked && on`, and inside
it sit the two notices: **"Headphones required."** (L262-266) and **"Open-loop approximation."**
(L305-309). The Designer correctly insists `isUnlocked()` semantics must not change. **Therefore an
auditioning user renders neither notice** — the gate is false — and the audition is precisely the moment a
free user first *hears* binaural or Deep Pulse. A user auditions binaural on a phone speaker, hears
something that physically cannot work, gets no notice, and is asked to pay at the end of the window. That
is the worst version of this feature and it is one boolean away from the best.

**Binding conditions on P4 / §3:**
1. The two notices gate on **audibility, not entitlement**: `on`, or `on && (unlocked || isAuditioning(id))`.
   Plain `on` is cleanest and fixes D7 for free. **Binaural may not be auditioned at all unless the
   headphones notice is on screen for the whole window.**
2. **The end-of-audition ask may not use Deep Pulse or binaural as its hook** (R3 — listed, never sold).
   "Deep Pulse faded out. Keep every layer" makes our least-evidenced layer the closer. Rain, fire,
   crickets, wind, thunder: fine. Those two: no.

With those two conditions, **approved**.

## E. P2 — does moving the layer cards one level down trip refusal #4? No

I read "point of choice" as the surface where a user chooses *that layer*, which is the card, and P2
leaves the cards unchanged. I am not going to read my own rule so expansively that progressive disclosure
becomes impossible — that would turn refusal #4 into a veto on the entire brief, which is not what it is
for. **P2 approved.**

**The Designer is right that the preset chips are the sharper version, and rather than leave it open I
will rule:** after P2 the chips become the primary point of choice on the arrival screen, which turns an
existing gap into a load-bearing one. **They do not need a badge chip** — a preset is a combination
inheriting mixed badges, and a single chip on it would be a fabrication, which is the thing this role
exists to prevent. What they need is that **the preset note keeps naming the evidence it inherits** (which
`presets.ts:17` and `:27` already do well) and that the Slow Wave and Focus Flow notes carry their
caveats front-loaded per R10. The fix is copy, not layout, and it is already in section A.

## F. Scenes and sleepscapes as the recurring promise — confirmed, and better than mine

The Designer read refusal #6 correctly and the distinction holds. A **scene** carries no evidence claim by
my own prior ruling (`WelcomeScreen.tsx:9-12`); a **sleepscape** is an arrangement of already-badged
layers and inherits claims already ruled on. Neither adds load to the badge system. **I can sign "a new
scene and a new sleepscape each month" where I cannot sign "a new sound each month."** Two conditions:
1. A new sleepscape may not combine layers so as to imply a *new* mechanism. "Deep Focus Pro" built from
   binaural at an untested beat is a new claim wearing a preset's clothes — that is D6, which is already
   shipping.
2. Scene marketing stays aesthetic. No sleep-outcome language for anything visual.

With those, this is a better recurring answer than the bibliography-updates one I proposed in section 4,
because it has perceived value and mine mostly has integrity. I withdraw mine in favour of theirs, and
note the two can ship together — the monthly drop is a scene and a sleepscape, and when the literature
moves, that month's note says so.


### Research Lead — finished (continuation) 22:09:59

Did: ruled on QA's Deep Pulse routing (one over-read declined, two rewritten, one missed site found in
the store listing plus a fifth in a preset name), wrote exact replacement copy for all five, added R10
(60-character truncation test) and R11 (paid copy is a promise), confirmed the paywall free-four veto,
stated the pink position, and cleared the Designer's audition and P2 with two binding conditions.
Changed: `tasks/simpler.md` only — verified with `git status`.
Next: nothing from me until the CEO rules. Available to review the Growth Lead's proposal against
R1-R11 when it lands.

### Growth Lead — finished 22:12:50

Did: read the code rather than the docs, priced the tier with the arithmetic shown, and answered the
CEO's four follow-ups against the Designer's and the Research Lead's filed entries. Changed: nothing
but this log. Every number is a URL or is marked `(reasoned, not measured)`.

**Headline recommendation, so it is not buried:** two plans — **$29.99/year (pre-selected) and
$4.99/month**, with a **14-day free trial**, the lifetime SKU **repriced from $4.99 to $79.99 before
it is ever activated**, and the ask fired **at the end of the first audition, in session one, but
never while the user is falling asleep**. The subscription's first billing cycle should not open
until one recurring thing exists, and I name exactly one.

---

## 0. Two facts about the shipping build that change this entire task

I want these first because both peers' entries, and `BUSINESS.md`, are written against a revenue model
that **does not currently exist in the binary**.

**Fact 1 — there are no ads. Not "test ads": no ads.** `package.json:43-49` excludes
`react-native-google-mobile-ads` from Expo autolinking (Kotlin 2.3 vs Expo SDK 57's 2.1.20). So
`hasNativeAdsModule()` (`ads.ts:71`) returns null, `loadSdk()` returns null, `initFailed = true`,
`canServe()` is false forever.

**Fact 2 — there is no purchase path.** `Billing.isAvailable()` returns `connected`, which is `false`
until `TODO(billing) 1 of 3` is written (`billing.ts:47, 118`). `PaywallSheet.runPurchase` therefore
always lands on `'Coming soon — the free unlock works tonight.'` (`PaywallSheet.tsx:124-127`).

Chain those through the grace rule and you get the thing nobody has written down yet:

> `Ads.showRewarded()` returns `false` with `lastRewardedFailure = 'unavailable'` →
> `PaywallSheet.tsx:101` `if (!earned && reason !== 'declined') earned = true` →
> `Entitlements.grantNightPass()`.

**Today, every single tap on "Unlock tonight" grants the full premium library, with no ad shown and no
revenue earned.** The paywall is not converting badly. It is a free-unlock button with a loading
message. The grace rule is correct and I am not touching it — but it was designed as insurance against
a bad ad night, and it is currently the *only* code path, permanently.

Consequence for this task: **there is no ad business to protect.** Every argument of the form "this
proposal costs us rewarded impressions" currently costs us $0.00. I use this below and it is the
single biggest reason I end up agreeing with the Designer rather than fighting them.

---

## 1. What recurs

**Today, nothing recurs. Not "not much" — nothing.** I went and counted rather than assumed, and this
is the finding the CEO asked for stated plainly.

| Thing a subscriber might get | State in code |
|---|---|
| 11 sound layers, 4 free / 7 paid | `types.ts:8-20`, `entitlements.ts:10`. A fixed literal array. |
| 9 presets | `data/presets.ts`. A frozen literal. |
| 5 scenes | `types.ts:24`. **Zero entitlement checks anywhere in `src/scenes/`.** All five are already free. |
| Saved mixes (max 40) | `MixesSheet.tsx:28`. Ungated, free. |
| Sleep timer, bedside, breathing pacer, nursery cap | All free, no `Entitlements` import in any of them. |
| 16 evidence cards | `data/evidence.ts` + inline. Ungated — the evidence dot renders on **locked** cards too (`LayerCard.tsx:150`). |
| Accumulating state | **None.** 7 AsyncStorage keys (`core/store.ts:17-25`). Every write is an overwrite. No session count, no streak, no nights-used, no first-launch date, no history of any kind. |
| Content pipeline | **None.** No remote config, no fetch, no CDN. The only network client in the app is the ad SDK, and it is not in the build. |
| Analytics | **None.** Zero SDKs, zero transport. The `bus` is in-process only. |

Two of those lines deserve calling out on their own:

- **"Every scene" is already free.** The paywall sells it twice (`PaywallSheet.tsx:180-182, 243-245`)
  and the code gates it nowhere. That is not a claim defect in the Research Lead's sense, but it is a
  **sales** defect: a third of our stated paid value proposition is already in the free tier.
- **Every utility feature is free.** Timer, bedside, breathing, nursery cap, mixes. So "premium" is
  precisely and only: *7 additional synthesis parameter sets, delivered once.*

**Why this is a policy problem and not only a product one.** Google Play's Subscriptions policy, verbatim:

> "Subscriptions must provide sustained or recurring value ... and may not be used to offer what are
> effectively one-time benefits."
> — https://support.google.com/googleplay/android-developer/answer/9900533

Taking `quietloom_premium_forever` — a permanent unlock of a fixed set — and billing it monthly is the
literal example that sentence prohibits. **If we ship the subscription as a renamed version of what
premium is today, we are not shipping a weak product. We are shipping a policy violation, on a brand
new personal developer account, against the one company that can switch us off.** That is my strongest
single reason for the sequencing in §2.

Play also confirms the way out: a one-time non-consumable may be sold alongside subscriptions
(https://support.google.com/googleplay/android-developer/answer/16430488), and Apple 3.1.2(a) says the
same and additionally protects existing buyers
(https://developer.apple.com/app-store/review/guidelines/). So the answer is not "kill the lifetime
SKU"; it is "make the subscription sell something the lifetime SKU does not."

### What would have to be built first — one thing, not a wishlist

I am naming exactly one, because a list is how this gets descoped into nothing.

**The nightly record.** A local, append-only log of nights: what played, how long before the timer took
it, how many nights this month, the current run. Six properties make it the right one:

1. **It genuinely accumulates.** Month six is worth more than month one. That is the definition of
   recurring value and the exact opposite of a one-time unlock. It satisfies "sustained or recurring"
   on its own terms, not by argument.
2. **It needs no server.** AsyncStorage, same as everything else. It does not cost us the
   "no server, no account, no data" position, which `BUSINESS.md:961-963` correctly calls a selling
   point and which is also an ASO asset (`sleep sounds no subscription` is in our keyword list).
3. **It makes no claim.** "You wound down 18 nights this month, 41 minutes average" is a log of what
   the *app* did. It never becomes R2-unsafe as long as the subject of every sentence is the app or
   the count, never "you" or "your sleep". I will write that copy to R5's standard and send it to
   Research before it ships.
4. **It is the substrate for the bedtime reminder** — which `BUSINESS.md:899-903` already calls the
   single highest-leverage retention feature, and which does not exist (`expo-notifications` is not a
   dependency). Same dependency, same wave. We get retention and recurrence from one build.
5. **It creates the cancellation cost.** A subscriber who cancels loses an accumulating record. That
   is the mechanic that makes month-two renewal a real decision rather than a formality, and we have
   nothing else that does it.
6. **It is small.** One storage key, one append, one sheet. Days, not weeks.

**Second recurring line, and I want it on the record that I am adopting the Research Lead's proposal
rather than inventing my own:** the maintained bibliography — "we keep reading the literature and we
tell you when it moves, including when it moves against us" (their §4). It is the only recurring thing
they say they could sign every month for years without inflating anything, and Basner 2026 moving
against our own default sound would have been issue one. Commercially it is thin on its own and they
said so themselves — but paired with the nightly record it is the half that is *undifferentiable*.
Sonora ships "Science Explainers" as uncited marketing copy; nobody in this category has a bibliography
that can move, because nobody has one.

**What I am explicitly NOT proposing as the recurring thing, and why:**

- **"New sounds every month."** I adopt the Research Lead's refusal (their §4) and add the commercial
  reason: a monthly content promise we miss in month four is a mass-cancellation event with the
  cancellation reason pre-written by us. Their arithmetic — 4-8 hours of reading per badged layer,
  50-100 hours a year, with a real rate of "no usable evidence" — means we would miss it. And their
  badge-inflation endgame is a churn machine: *"I pay every month and everything I pay for is badged
  Traditional"* is both a one-star review and true.
- **Cloud sync / accounts.** `BUSINESS.md:961-963` rules it out and is right. Building a server to
  justify a subscription is the tail wagging the dog, and it converts our cleanest privacy position
  into a GDPR liability for a feature nobody asked for.
- **More scenes as a sleep benefit.** Research's constraint from `WelcomeScreen.tsx:9-11` binds:
  scenes are sellable as aesthetics and nothing else.

**The honest caveat, stated rather than papered over:** the nightly record plus a bibliography feed is
not obviously worth $29.99/year on its own, and I am not going to pretend it is. What it is worth is
**the right to charge at all** — it is the minimum that makes the subscription policy-clean, brand-
consistent and renewable. The library, the ad-free operation and the utility set are what people
actually pay for; the recurring layer is what makes it legitimate to bill for them repeatedly.

---

## 2. The tier shape and the price, with the arithmetic

### The recommendation

| SKU | Price | Presentation |
|---|---|---|
| **Premium — Annual** | **$29.99 / year** | Pre-selected, primary, accent-filled |
| **Premium — Monthly** | **$4.99 / month** | Secondary, plain, fully usable |
| **Premium forever** (`quietloom_premium_forever`) | **$79.99**, up from $4.99 | Secondary link: "Prefer to buy once? →". Not a third plan. |
| Free tier | unchanged, **plus campfire** — see §6 | Never degraded |
| Night pass (rewarded) | unchanged, grace rule intact | Stays, restyled to second |

Two visible plans, because H&F ships exactly two on **60%** of paywalls — the highest two-plan share of
any category (RevenueCat *State of Subscription Apps 2026*,
https://www.revenuecat.com/state-of-subscription-apps ·
https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026/).

### The arithmetic, shown so it can be argued with

**Step 1 — how long a subscriber actually pays.** Sourced renewal rates, Health & Fitness and
all-category (RevenueCat 2026,
https://www.revenuecat.com/blog/growth/average-subscription-renewal-rates-by-app-category/ ·
https://www.revenuecat.com/blog/growth/one-year-retention-rates-insights): monthly first renewal
**57%**, monthly still-subscribed at 12 months **11%**, annual first renewal **25%**.

Fitting a decay to those two monthly anchors: from month 2 (0.57) to month 12 (0.11) is a ratio of
0.193 over ten periods, so monthly retention `r = 0.193^(1/10) = 0.848`. Billing periods paid in year
one:

```
1 + 0.57 x (1 - 0.848^11) / (1 - 0.848)  =  1 + 0.57 x 5.49  =  4.13 months
```

**A monthly subscriber pays ~4.1 months in year one.** `(reasoned from sourced renewal rates, not
measured)` Annual pays exactly 1 period in year one.

**Step 2 — net per payer, year one.** Play's fee is now **10% service + 5% billing = 15%** effective
as of 30 June 2026 (https://android-developers.googleblog.com/2026/06/play-expanded-billing.html) —
same headline as the old "15% of the first $1M", but split, and the 5% is avoidable via alternative
billing later. I use 15%.

| Plan | Gross, year 1 | Net at 85% |
|---|---:|---:|
| $2.99/mo (BUSINESS.md sketch) | 4.13 x $2.99 = $12.35 | **$10.50** |
| **$4.99/mo (proposed)** | 4.13 x $4.99 = $20.61 | **$17.52** |
| $19.99/yr (BUSINESS.md sketch) | $19.99 | **$16.99** |
| **$29.99/yr (proposed)** | $29.99 | **$25.49** |
| $39.99/yr (category median) | $39.99 | **$33.99** |

**Step 3 — blend at the category mix.** H&F annual adoption is **68%** (RevenueCat 2026); Adapty puts
annual pre-selection against a monthly decoy at **69-74% annual selection**
(https://adapty.io/state-of-in-app-subscriptions/). Using 68%:

```
BUSINESS.md sketch ($2.99 / $19.99):  0.68 x $16.99 + 0.32 x $10.50 = $14.91 net / payer / yr
PROPOSED          ($4.99 / $29.99):  0.68 x $25.49 + 0.32 x $17.52 = $22.94 net / payer / yr
```

**+54% per payer over the sketch, from the price alone.**

**Step 4 — does the higher price cost us payers?** The most relevant sourced number I have says no:
Adapty finds **high-priced annual plans return $70 LTV against $17 for low-priced — a 4x gap**
(https://adapty.io/state-of-in-app-subscriptions/). Cheap annual pricing is not the revenue-maximising
play in this data. And ~**90% of subscriptions sell at full price**; only ~10% of apps discount.

**Step 5 — sanity against the market.** $29.99/yr sits **below** every positional comp:

| App | Monthly | Annual | Lifetime | Source |
|---|---|---|---|---|
| **Quietloom (proposed)** | $4.99 | **$29.99** | $79.99 | — |
| Sonora (nearest positioning) | $6.99 | $39.99 | — | https://apps.apple.com/us/app/sonora-sleep-focus-sounds/id6742157763 |
| Portal | $2.99 | $29.99 | $99.99 | https://apps.apple.com/us/app/portal-escape-into-nature/id1436994560 |
| Dark Noise | $2.99 | $19.99 | $49.99 | https://apps.apple.com/us/app/dark-noise-ambient-sounds/id1465439395 |
| Pzizz | $4.99 / $7.99 | $49.99-$69.99 | — | https://apps.apple.com/us/app/pzizz-sleep-nap-focus/id915664862 |
| Headspace | $12.99 | $69.99 | — | https://apps.apple.com/us/app/headspace-sleep-meditation/id493145008 |
| Calm | $14.99 | $69.99 | $399.99 (web only) | https://apps.apple.com/us/app/calm/id571800810 |
| **H&F median** | **$9.99** | **~$39.94** | — | RevenueCat 2026 |

BetterSleep and Endel I could not verify cleanly — BetterSleep's own FAQ refuses to publish prices
(https://www.bettersleep.com/support/en/articles/5371738) and its IAP list spans $11.99-$99.99;
Endel's store list and secondhand reporting disagree by ~2x and endel.io/pricing is dead. **Flagged as
unverified rather than filled in.**

**Why $29.99 and not $39.99.** $39.99 matches the category median exactly and matches Sonora, and the
LTV data above argues for it. I am recommending against it for one reason and it is a Growth reason,
not a timid one: **price is a claim.** We would be charging the category median for a smaller library,
no ratings, no brand, and — at launch — one recurring line. We refuse to over-claim in copy; charging
as if we were Sonora is the same act in a different field. **$39.99 becomes correct once the recurring
thing has shipped and we have ratings.** Raising a subscription price later is mechanically easy on
Play (existing subscribers are grandfathered and an increase requires their consent); cutting one is a
public admission. Start below and earn up.

### Trial: yes — 14 days

**Sourced:** trial-to-paid by trial length is **≤4 days 25.5% · 5-9 days 37.4% · 17-32 days 42.5%**
(RevenueCat 2026). H&F trial-to-paid **37.7%** (RevenueCat) / **42.2%** (Adapty,
https://adapty.io/blog/health-fitness-app-subscription-benchmarks/). Adapty additionally finds trials
**raise** LTV in Health & Fitness specifically, where they lower it in Productivity and Lifestyle.
Market is drifting to ≤4-day trials — 46.5% of apps — and on this data the market is wrong.

**Product reason, which is stronger than the benchmark:** our value takes nights, and standing
decision 3 means we deliberately deliver a *short* nightly dose — 45 minutes, then we turn ourselves
off. A 3-day trial is three nights, one of which was spent fiddling rather than sleeping.

**Why 14 and not the top bucket, stated as a departure from the data.** The 17-32 day bucket converts
best in the raw numbers, but RevenueCat reports it as an observed correlation, not a controlled test —
apps that offer month-long trials are plausibly different apps (higher priced, more considered
purchase), and I will not treat a confounded number as causal. Against it: **31% of Google Play
cancellations are involuntary billing failures against 14% on the App Store** (RevenueCat 2026), so a
longer trial widens the window in which a card goes stale before it is ever charged. 14 days is two
full weekends and keeps the conversion event inside a cycle we can still read. **Test 21 vs 14 as the
first structural experiment once instrumented** — Adapty puts trial-structure experiment win rates at
**59.6%** against **34.6%** for copy-only changes, so this is the highest-value test we will have.

**Play mechanics that bind the trial** (https://support.google.com/googleplay/android-developer/answer/12154973):
free trials run 3 days to 3 years; the model is subscription → base plans → offers; the trial must
disclose duration, that the user *"will be automatically enrolled in a paid subscription at the end of
the offer period"*, the post-trial price, and how to cancel. And R7 binds the copy: **"Free for 14
nights" is available; "see the difference in 14 nights" is not.** I have no need for the second one.

### Intro pricing: no

Play permits it (intro price ≤ base price, as absolute, fixed or percentage). I am declining it.
Stacking a discounted first period on top of a 14-day free trial gives a user two consecutive periods
in which they are not paying what they think they are paying, and that is precisely the shape that
produces the "I didn't know I was being charged" review. ~90% of subscriptions sell at full price
anyway (Adapty). One trial, then the real price.

### `quietloom_premium_forever` — the most time-sensitive item in this entry

The frozen contract is safe: **I am not proposing any change to the product ID, to
`Billing.PRODUCT_ID`, to `isAvailable()`, or to the `Entitlements.isPremium()` branch in
`PaywallSheet.tsx:176-186`.** The "Premium is active / You have every sound, every scene, forever"
screen survives verbatim, which is exactly what Apple 3.1.2(a) requires and what Play permits.

**But the price is wrong and the window to fix it closes permanently.**

At $4.99 against a $29.99 annual, the subscription is **strictly dominated** — one year costs 6x what
forever costs, for the same content. No rational user buys the subscription. Worse, at $4.99 the
lifetime SKU is an **unbounded liability**: it promises every future layer against the Research Lead's
4-8-hours-per-layer pipeline, i.e. we would be selling 50-100 hours a year of research, forever, for
the price of a coffee. That, not cheapness, is why $4.99 is the wrong number.

**Repriced to $79.99**, it sits at **2.67x annual** — squarely in the category norm (Dark Noise 2.5x,
Endel ~2.1x, Portal 3.3x, Calm 5.0x; RevenueCat's own worked examples span 2.1x-11.5x,
https://www.revenuecat.com/blog/growth/lifetime-subscriptions). RevenueCat also reports **23.2% of
subscription apps already ship subs + lifetime**, so this is a normal shape, not an exotic one.

**And here is the part that must be acted on this week rather than debated next month.**
`BUSINESS.md` step 11.2 — create the product in Play Console — **has not been done.** Billing is a
stub, `isAvailable()` is false, no build has been uploaded to a track, and Play will not even let you
create an in-app product before that. Therefore:

> **There are currently zero buyers of `quietloom_premium_forever`. Repricing it today betrays
> literally nobody. The day it is activated at $4.99 and one person buys it, this becomes a
> betrayal problem forever.**

The brief says existing buyers must not be betrayed. They will not be — the set is empty, and anyone
who ever buys at any price keeps everything the string promises. But the window is open right now and
it closes with step 11. **This is the one item in my entry with a deadline.**

One knock-on for the store listing, flagged for whoever owns the fix: `BUSINESS.md:654` currently ships
the sentence **"No subscription."** in the full description, and §5 lists
`sleep sounds no subscription` as a target keyword. Both are now false and both are mine to fix — but
not this wave, per the no-doc-edits rule. Logging it so it is not discovered by a reviewer.

---

## 3. The ask moment

**The moment: the end of the user's first audition of a locked layer — in session one, on the mixer,
while they are still looking at the screen. Never on a timer that can expire while they are falling
asleep.**

I am adopting the Designer's audition mechanic (their §3) and **disagreeing with their timing**, which
is the one substantive disagreement I have with either peer.

### Why session one, not session two — Lead 3 is wrong and I verified it independently

My own research returned, without seeing the Designer's entry: **82% of trial starts happen the same
day as install** (RevenueCat 2026), and Adapty's install-denominated placement table —
**onboarding + trial 1.35% · in-app + trial 0.89% · onboarding no trial 0.82% · in-app no trial
0.76%** (https://adapty.io/state-of-in-app-subscriptions/ ·
https://adapty.io/blog/high-performing-paywall-2026/). The Designer cites 89.4% where I have 82%;
different pages of the same report, same direction, same order of magnitude. **The earlier placement
wins by roughly 50% on the only install-denominated comparison either of us can find.** Lead 3's
"session two or day two" tactic does not survive that.

**Independent corroboration worth noting:** my researcher and the Designer separately flagged the
*same* circulating figure — "65% trial start after a value moment vs 31% on an immediate hard
paywall" — as unusable. It appears only on aggregators, its source page returns HTTP 403, and it
contradicts Adapty's own published placement table. Two independent passes reaching the same
conclusion is the strongest signal in this entry that the Designer's numbers were honestly worked.
**`(unverified — do not use)`**, and it is the number most likely to be quoted at us in defence of
Lead 3.

**My one refinement, which matters for pricing.** Most of those figures are *trial-start* denominated,
and "trial starts happen on install day" is close to circular for apps that only offer the trial in
onboarding — it shows that apps which ask only on Day 0 get only Day 0 conversions. The genuinely
non-circular number is Adapty's placement table, and it does favour early. **So: Day 0, session one.
Lead 3's tactic is wrong and its principle — value before the ask — is right.**

### Why not the Designer's minute-seventeen

The Designer lands on "15-minute audition, ask when it expires," correctly noting that minute 17 is
still Day 0. **But our own product rules forbid that moment.** The sleep timer defaults ON at 45
minutes (standing decision 3). A user who starts a mix and puts the phone down has, at minute 15, been
lying in the dark for ten minutes. `MONETIZATION-WIRING.md:96-97` already bans wiring monetisation to
`timer:done` or `audio:stopped` because *"those fire while the user is asleep or falling asleep."*
**The subscription ask inherits the ad placement rules.** A fade-out plus a "Keep every layer →" strip
at 23:52 is the 03:00-interstitial problem wearing a different hat, and it is a one-star review from
the exact user who was enjoying the product most.

### The fix — the audition clock runs on attention, not wall time

The audition timer advances **only while the app is foregrounded and the mixer is visible.** If the
user opens bedside mode, starts the sleep timer, or backgrounds the app, the audition **pauses** — the
layer keeps playing free for the rest of that session, which per standing decision 5 costs us exactly
nothing — and the ask is held until the next time they are actually looking at the mixer.

That gets every property at once:

- The ask lands **after** demonstrated value — they chose that layer, heard it in their own mix.
- It lands while the user is **awake and looking at the screen**, which is the only state in which an
  ask is fair or effective.
- It **never fires on a sleep surface**, which is non-negotiable and which the 15-minute version
  violates.
- For most users it is still **Day 0, session one** — people fiddle with the mixer for several minutes
  before settling. `(reasoned, not measured)`
- For the user who taps "Hear it" and immediately puts the phone down, the ask arrives next session.
  That is a minority, and **asking them at 23:52 was never available to us anyway** — so we lose
  nothing we were entitled to.

**Not the ask moment, and I want these on the record as rejected:** onboarding minute one (nothing has
been demonstrated, and we have no onboarding to put it in); the preset tap (see §5); timer expiry
(banned); app open (that is the interstitial slot and it is a sleep-adjacent moment); and any
"somewhere in onboarding" formulation, which the brief correctly calls not an answer.

---

## 4. The metrics that would prove it, at zero analytics

`BUSINESS.md:965-968` argues against shipping an analytics SDK — Play Console gives retention and
installs, AdMob gives revenue, and the privacy story stays clean. **That argument was made for an
ad-funded app and it does not fully survive a subscription** — you cannot run a trial funnel blind,
and trial-structure experiments are the highest-win-rate lever we have (59.6%, Adapty).

**My recommendation: still do not ship an analytics SDK for launch.** Play Console's Subscriptions
dashboard is free, native, requires no `PRIVACY.md` change and no Data safety re-declaration, and it
carries most of the funnel. Six numbers, with sourced targets:

| # | Metric | Source | Healthy | What a miss means |
|---|---|---|---|---|
| 1 | **Installs → trial starts** | Play Console | H&F download-to-trial **6.9%** (RevenueCat), **9.5%** global / **14.5%** NA (Adapty) | Under ~3% the paywall is not being *reached*. That is a placement problem, not a price problem — do not cut price to fix it. |
| 2 | **Trial → paid** | Play Console | H&F **37.7%** (RC) / **42.2%** (Adapty) | Under ~25%: trial too short, or the value did not land in 14 nights. |
| 3 | **Annual share of new subs** | Play Console | **60-70%** (H&F is 68% annual) | Low annual share *with annual pre-selected* means the monthly/annual gap is mispriced. |
| 4 | **Involuntary vs voluntary cancels** | Play Console | Play baseline **31%** involuntary vs 14% iOS | Above 31% and this is dunning, not dissatisfaction. Fix with grace period, not price. |
| 5 | **D1 / D7 retention** | Play Console | **25-35% / 10-15%** (charter) | If the subscription launch moves these *down*, the paywall is damaging the product. This outranks revenue. |
| 6 | **Rating + refund rate** | Play Console | stay **above 4.0** | Below 4.0 suppresses us in search and costs more in lost installs than the tier earns (`BUSINESS.md` §5). |

**#4 deserves a line of its own because it is Android-specific and it is a revenue lever, not a
checkbox.** Play auto-calculates account hold as *60 days minus grace period*, and the two must total
≥30 days (https://support.google.com/googleplay/android-developer/answer/12154973). With 31% of Play
cancellations being billing failures, configuring this deliberately is worth real money.

### The honest answer to "within two weeks"

**We cannot know #2 in two weeks, and I will not shorten the trial to fake it.** A 14-day trial means
the first cohort's conversion event lands on day 15; with review and staged rollout the first readable
trial-to-paid number is **day ~18-21**. What we *can* know at two weeks is #1, #3, #4, #5 and #6 —
and #1 is the failure mode that actually kills this. If nobody reaches the paywall, the price was
never the question.

**And the schedule is longer than two weeks before any of it starts.** The gates compound:

1. **12 testers opted in continuously for 14 days** before production access can even be applied for —
   personal accounts created after 13 Nov 2023, unchanged in 2026
   (https://support.google.com/googleplay/android-developer/answer/14151465). Review is then
   *"7 days or less, but may occasionally take longer."*
2. **In-app products cannot be created until a build is on a track** (`BUSINESS.md` step 11.2), and
   **real purchase flows only work for a build installed from Play** and signed with the upload key —
   so the subscription plumbing cannot be validated before the closed test exists.
3. Then 14 days of trial.

**Earliest possible first real trial-to-paid number: roughly 5-6 weeks from the day the Play account is
created**, and the account does not exist yet. Nothing compresses this. It is the strongest argument I
have for building the recurring thing *now* rather than treating it as a follow-up — the calendar gives
us the time for free.

**One instrumentation item I would ship, and it is not analytics:** the app needs
`expo-notifications` anyway for the bedtime reminder and for the trial-ending notice in §5. That is a
dependency and a permission, not a tracking SDK, and it changes no privacy claim.

---

## 5. What I refuse to ship

My charter already lists ads on sleep surfaces, dropping the grace rule, and declaring children as a
target audience. Those stand untouched. Subscription-specific, in this category:

1. **A subscription that bills for a one-time benefit.** Play's Subscriptions policy prohibits it in
   terms (§1). Renaming today's premium into a monthly charge is that exact thing, on a new personal
   account. **This is the refusal that drives everything else in this entry.**

2. **A trial that converts silently.** Play already requires disclosure of duration, auto-enrolment,
   post-trial price and how to cancel. **I go further: a local notification on day 12 of the 14-day
   trial saying it ends in two days and what it will cost.** This will cost us conversions and I am
   recommending it anyway. Nobody in this category does it; ROSCA is in force and being enforced
   (Chegg $7.5M Sept 2025 for failure to provide simple cancellation; Shutterstock $35M May 2026 for
   misleading auto-renewal disclosure —
   https://www.consumerfinancialserviceslawmonitor.com/2026/05/ftc-targets-shutterstocks-negative-option-subscriptions-in-35-million-settlement/);
   the FTC's click-to-cancel rule was vacated 8 July 2025 but the ANPRM reviving it issued 11 March
   2026 (https://www.gibsondunn.com/ftc-restarts-negative-option-rulemaking-after-eighth-circuit-vacatur-enforcement-under-rosca-continues/);
   and the EU Digital Fairness Act explicitly targets misleading free trials and convoluted
   cancellation (https://www.europarl.europa.eu/legislative-train/theme-protecting-our-democracy-upholding-our-values/file-digital-fairness-act).
   **An app that publishes the systematic review saying its own category's evidence is weak cannot
   ambush people with a renewal.** The rule is gone; the liability and the brand cost are not.

3. **Price-per-week or per-day framing of the annual plan.** Apple's rule is explicit and citable: the
   billed amount *"must be the most prominent pricing element in the layout"* and any equivalence must
   be *"in a subordinate position and size"* (https://developer.apple.com/app-store/subscriptions/).
   **"$29.99/year" is the largest element.** "About $2.50 a month" may sit smaller beneath it. We will
   never lead with "$0.57 a week."

4. **Fake urgency.** No countdown timers, no "50% off, 10 minutes left", no fabricated scarcity. I
   checked for a named store-policy ban on countdown timers specifically and **could not find one** —
   so I am refusing this on brand and on the DFA's stated targeting of pressure patterns, not on a
   citation I do not have.

5. **"Cancel anytime" as reassurance while cancelling is hard.** We link Play's Subscription Center
   directly from settings; Play confirms that satisfies the easy-cancellation requirement.

6. **Any paywall on a sleep surface, or on timer expiry.** `MONETIZATION-WIRING.md` §3 bans it for ads;
   **the subscription ask inherits the same rule.** This is what forces my disagreement with the
   Designer in §3, and it is the constraint I would defend hardest, because it is the one that costs
   us measurable money.

7. **Degrading the free tier to manufacture pressure.** Rain, ocean, pink, brown, the default preset,
   the timer, bedside, breathing, the nursery cap, saved mixes and every evidence card stay free.
   Endel caps its *free* tier at ~10-minute sessions; we will not. The commercial version of this
   argument, not just the ethical one: **the genuinely useful free tier is what makes the evidence
   positioning credible, and the positioning is the only reason anyone picks us over Sonora at
   $39.99.** Erode it and we are a worse Dark Noise at a higher price.

8. **"New sounds every month" as a promise.** Adopting the Research Lead's refusal, for the commercial
   reason in §1.

9. **Deep Pulse or binaural as headline subscriber benefits.** R3 and R4 bind, and the commercial edge
   is sharper than the claims one: binaural sold without "headphones required" in the same visual unit
   is a "product not as described" refund, and at volume a chargeback pattern. Refunds are an account-
   health signal on Play, not merely a cost line.

10. **A subscriber ever seeing an ad — and this one is an engineering trap, not a policy point.**
    `ads.ts:190` gates every ad path on `Entitlements.isPremium()`. A *subscriber* is not necessarily
    `isPremium()` under a new entitlement model. **Whatever the new entitlement is, it must feed the
    same `canServe()` gate**, or we will show ads to people paying us not to see them, on the day we
    launch. Naming it here because it is exactly the kind of thing that passes a green build.

---

## 6. The CEO's four questions, answered directly

**Q1 — Is the Designer right that Lead 3 is wrong?** **Yes, on the tactic; no, on the principle.**
Verified independently — see §3. My own research returned 82% of trial starts on install day where
they cite 89.4% (different pages, same direction), and the same Adapty placement table. The
non-circular number is the placement table and it favours early. **Ask in session one.** But the
Designer's specific moment violates our own sleep-surface rule, and my §3 fix keeps their mechanic and
their timing while obeying it. Both of us independently rejected the "65% vs 31%" figure as
unverifiable; the CEO should expect it quoted and should not accept it.

**Q2 — Do I object to deleting the 7 auto-paywalls?** **No. I agree with the Designer, on the numbers,
and more strongly than they put it.**

Today those seven modals produce **exactly $0.00 and cannot produce anything else**: the purchase path
is dead (`isAvailable()` false) and the rewarded path grants the unlock free (§0). So the current state
is — tap a preset, hear a *worse* sound, get interrupted by a modal, and be handed the entire premium
library for nothing. Seven times a session. We are paying a retention cost for an impression that
monetises at zero and gives away the product.

Even once billing works, nothing in the literature says more impressions per session earns more. What
*is* documented is that Play's Subscriptions policy bans *"deceptive or manipulative purchase
experiences"* and names as non-compliant UI in which repeated taps in the same screen region cause an
inadvertent tap on the subscribe control. A modal firing 260 ms after a tap the user did not associate
with buying anything, seven times in nine, is walking toward that line rather than away from it.

**Delete them. My one condition is not a paywall:** the non-modal offer already in the note card
(`Unlock the missing layer(s)`, via `LinkButton`, fires only when `activeLocked.length`) stays and gets
the styling attention the modal was stealing. We keep the offer and lose the ambush — strictly better,
not a concession. I also back their P3(b): Campfire producing zero audio change for a free user must
not be tappable into a no-op.

**Q3 — What does the 15-minute audition do to rewarded-video views?** **Nothing, because there are
none.** §0: the ad SDK is not in the build, so `showRewarded()` always fails and the grace rule always
grants. Rewarded views today are zero and revenue is zero.

**And even on the optimistic future where ads are restored, the trade is not close.**
`BUSINESS.md:219` models the entire rewarded line at $135/month per 1,000 DAU = **$1.62 per DAU per
year**. One subscriber nets **$22.94 in year one** (§2). **One subscriber is worth roughly 14
DAU-years of rewarded video.** The audition only has to convert at ~7% of the rate at which it
cannibalises rewarded views to break even. `(reasoned, from BUSINESS.md's own eCPM assumptions and the
renewal arithmetic in §2)`

So I do not contest it — I endorse it, and I would go further than the Designer: **the audition is the
best proposal in either peer's entry**, because it is the only one that manufactures a *moment of
loss*, and loss is what a subscription is actually sold against. Standing decision 5 means a locked
layer costs us nothing to play; we are the only app in the category that can let someone hear the exact
thing being sold, in their own mix, in their own bedroom. Their abuse mitigation is right and their
instinct to under-engineer it is right: the marginal cost of someone hearing synthesised fire is zero,
so a leaky audition is a marketing expense.

**My amendments, both in §3:** the audition clock must run on attention rather than wall time, and
`isUnlocked()` semantics must not change — `Entitlements.startAudition()` / `isAuditioning()` additive,
and the *new* entitlement must feed `canServe()` (refusal 10).

**Q4 — What does the free-four claim mean commercially?** The Research Lead recommends fixing the
sentence; the Designer recommends fixing the sentence now and argues making campfire free is worth the
CEO's time. **My commercial position: do both — fix the sentence immediately, and move campfire to the
free tier at subscription launch, not before.**

- **Fix the sentence now** because it is vetoed and it is free to fix. That is Research's call and I
  support it without qualification.
- **Move campfire at launch** because **a subscription launch must make the free tier more generous,
  not less, or it reads as a takeaway.** Adding a fifth free layer on the day we start charging is the
  cheapest goodwill available to us, and it retires the veto permanently instead of routing around it —
  standing decision 4's sentence becomes literally true and stays true.
- **Cost:** 7 paid layers become 6. That is a smaller loss than it looks, because per §1 **the layers
  were never the recurring value**. We give away the one with the best primary study (Lynn 2014, ~227
  participants, muted-fire control) and the most vivid demo copy — *"in the study, silent fire did
  nothing; the sound is the effect"* — and it becomes our best advertisement, at zero marginal cost.
- **The counter I have to concede:** the Designer is right that fire is the most emotionally appealing
  paid layer. That is exactly the argument for making it free. The layer that makes people trust us is
  worth more in the free tier than the ~1/7th of a paid library it represents.

If the CEO would rather not move campfire, Research's option 1 alone is sufficient and safe — but then
the free tier does not grow at launch, and I would want something else in its place.

---

## 7. Where I disagree, on the record

- **With Lead 3 (the CEO):** session two / day two is wrong. Ask in session one. §3.
- **With the Product Designer:** their 15-minute audition fires the ask while the user is falling
  asleep, which our own rules forbid. Same mechanic, attention-based clock. §3. This is the only place
  we genuinely differ and I would rather it were ruled on than split.
- **With `BUSINESS.md` days 11-18 (my own document):** $2.99/$19.99 is ~35% too cheap per payer, the
  7-day trial is too short, and "do not remove the lifetime option" is right while "$4.99" is wrong.
  §2. I will rewrite that section when the CEO routes it.
- **With `BUSINESS.md:965-968`:** "no analytics SDK" survives, but only because Play Console's
  subscription dashboard covers the funnel. It is no longer true that we need nothing. §4.
- **With nobody, but flagged:** `BUSINESS.md:654` still ships **"No subscription."** in the store
  description, and §5 targets the keyword `sleep sounds no subscription`. Both are now false.

## 8. The single thing most likely to make this fail

Not the price, and not the ask moment. **It is shipping the subscription before anything recurs, and
discovering it at the first renewal.**

Monthly first renewal in this category is **57%** and annual is **25%** — and those numbers come from
apps that delivered *something* in the interim. Ours would deliver, in month two, precisely what it
delivered in month one: the same layers, already fully heard, on a paywall that already sold "every
scene" when scenes were free. The cancellation would not be a churn statistic; it would be the user
being right. On Play that arrives with refund requests and one-star reviews attached, on a brand new
account, in a category where the rating is the whole distribution strategy.

The fix is cheap and it is on the critical path anyway: **the nightly record and the bedtime reminder
are the same build**, the Play closed-test clock gives us 5-6 weeks of calendar for free, and the
recurring line is what makes the whole tier legitimate rather than merely legal.

**Next:** nothing without the CEO's ruling. If it lands my way the order is — (1) reprice
`quietloom_premium_forever` to $79.99 before step 11 activates it, which has a deadline and nothing
else here does; (2) build the nightly record + bedtime reminder; (3) wire billing and the two plans;
(4) launch the subscription with campfire moved to free. Paywall copy goes to the Research Lead before
any of it ships.


### Growth Lead — addendum 22:17:46 (read against the Research Lead's final ruling)

Their ruling landed after my reads; reconciling rather than leaving my entry stale.

**It strengthens my §6 Q4 recommendation and changes no number in §2.** With pink demoted to Moderate
(Basner 2026), the `Strong` set is rain, ocean, fire — so **campfire is now the only paid layer in the
entire Strong tier**, and the Research Lead notes Lynn 2014 is untouched by Basner 2026, making it the
most robust primary study in the bibliography. My position was `move campfire to free at subscription
launch`; that was the weaker case an hour ago and it is the stronger one now. Their own line — *"if the
founder wants the free tier's justification to survive the next finding rather than needing rewriting
again, campfire is the layer that carries it"* — is the same conclusion from the claims side.

**Commercially this is now close to free.** I argued in §6 that giving away campfire costs us 1 of 7 paid
layers and buys goodwill at launch. Post-ruling it also buys the thing money cannot: a free tier whose
justification does not need rewriting every time a paper lands. **I withdraw my hedge** ("if the CEO
would rather not move campfire, option 1 alone is sufficient") — option 1 remains sufficient for the
*veto*, but it is no longer sufficient for the *tier*. Recommend both: ship their replacement sentence
immediately, move campfire at launch.

**Nothing in §2 moves.** The price, the trial, the .99 lifetime reprice and its deadline are all
independent of badge assignments. **Nothing in §5 moves** — refusal 9 (Deep Pulse and binaural never
headline benefits) already sat under R3/R4 and their ruling does not loosen it.

One consequence I own and will carry into `BUSINESS.md` when routed: the full description at
`BUSINESS.md:596-662` contains the pink-noise paragraph, the "four with the strongest evidence" framing
and the sentence **"No subscription."** All three are now wrong for different reasons. R9 makes the store
listing a claim surface, so that rewrite goes past the Research Lead, not just past me.

### CEO - closing the research wave 22:19:36
Did: read all three reports. Ruled on what is mine, and separated out what is the founder's.

THE FINDING THAT REORDERS EVERYTHING: nothing recurs. The Growth Lead counted rather than
estimated - all five scenes are already free despite the paywall selling them twice, every
utility feature is free, and nothing accumulates in any of the seven storage keys. Google Play
prohibits subscriptions for "effectively one-time benefits" in those words. So a subscription
on today's product is not a weak offer, it is a policy violation on a new personal developer
account. We cannot sell the founder what he asked for until something recurs. That is not a
refusal of the instruction; it is the shortest path to executing it.

SECOND FINDING, equally load-bearing and nobody was looking for it: the ad SDK is excluded from
autolinking, so every "watch a video" tap ALREADY grants the full library, with no ad shown and
no revenue earned. Our current monetisation gives the product away for free. Two consequences:
the audition cannibalises nothing, because there is no ad business to cannibalise; and the seven
auto-paywalls monetise at exactly $0.00 while handing over everything.

RULINGS (mine):
 1. THE AUDITION IS APPROVED, with the Growth Lead's correction, not the Designer's original.
    The clock runs only while the mixer is foregrounded. The Designer's 15-minute wall clock
    fires the ask at about 23:52, into sleep onset, which our own standing decision 1 forbids -
    the rule is about protecting that moment, not about the literal word "ad". Same mechanic,
    same session-one ask, obeys the rule. This is the one real disagreement in the wave and I am
    deciding it rather than splitting it.
 2. THE AUDITION'S CAVEATS GATE ON AUDIBILITY, NOT ENTITLEMENT (Research Lead's condition).
    Today LayerCard.tsx:222 gates the headphone notice on `unlocked && on`, so an auditioning
    user would hear binaural on a speaker with no notice and then be asked to pay for it. That
    is selling a thing we say is physically impossible under those conditions. Non-negotiable.
 3. THE SEVEN AUTO-PAYWALLS GO. A preset tap that returns a broken mix - or in Campfire's case
    literally nothing - followed 260 ms later by a paywall, is the worst pattern in the app. It
    is not even a trade: it earns $0.00. Designer and Growth agree, Research does not object.
 4. RESEARCH'S REPLACEMENT COPY LANDS, all five Deep Pulse sites including the store listing at
    BUSINESS.md:631-632 that QA missed and that Play truncates mid-claim. The veto is the point
    of that role and I am not going to be the CEO who overrides it to keep a nicer sentence.
 5. LEAD 3 WAS WRONG AND I AM RECORDING IT AGAINST MYSELF. I said the honest ask moment was
    probably day two. Designer and Growth independently found ~89% of trial starts happen on
    install day. The principle inside the lead survives - value before the ask - but the timing
    was wrong and both of them said so in writing, which is what I asked for.
 6. NO SUBSCRIPTION SHIPS UNTIL SOMETHING RECURS. Sequencing, not a veto on the founder's
    instruction. The Growth Lead names one thing to build first - a local nightly record, no
    server, no claim, accumulates by nature. I agree it is the right first one.

FOR THE FOUNDER, because they are not mine to take:
 A. STANDING DECISION 4's WORDING. Pink is demoted Strong -> Moderate on Basner 2026. The free
    four can no longer be described as "the four with the strongest evidence" - and that exact
    sentence is printed on the paywall while our own evidence.ts badges Campfire Strong-and-paid
    and Brown Moderate-and-free. My recommendation: change the claim, not the free four, and make
    Campfire free, which fixes the claim in one move. The decision is the founder's.
 B. THE REPRICE WINDOW IS OPEN AND CLOSES ON ACTIVATION. quietloom_premium_forever was never
    activated in Play Console, so there are ZERO lifetime buyers and repricing today betrays
    nobody. The day it goes live at $4.99 the price is permanent, it strictly dominates any
    annual plan, and it promises every future layer against a 4-8 hour-per-layer research
    pipeline. Growth recommends $79.99. This is the only deadline-bound item in the wave.
 C. THE PROCESS GAP. Basner 2026 published four months ago and we found it by accident during a
    UI task. A subscription re-asserts every claim to every subscriber every billing period.
    We have no mechanism that notices when the literature moves.
Changed: nothing under src/. This entry only.

### CEO - landed the claim copy 22:43:08
Did: executed my own ruling 4 rather than leaving a live standing-decision breach sitting in the
shipping bundle overnight. The Research Lead wrote the wording; I only placed it. Cross-ownership
taken deliberately and stated: evidence.ts is the Research Lead's, LayerCard.tsx and PaywallSheet.tsx
are the Junior Frontend Engineer's, BUSINESS.md is the Growth Lead's. All three had filed finished
entries; nobody was in these files. presets.ts is mine.

Changed, all five Deep Pulse sites plus the paywall claim:
 1. src/data/evidence.ts:128 - claim, replaced verbatim with the Research Lead's string.
 2. src/data/presets.ts:104 - preset note, verbatim.
 3. src/ui/screens/LayerCard.tsx:37 - COPY.deeppulse, verbatim.
 4. BUSINESS.md:631-632 - the store listing bullet. R11 says this one outranks src/, because it is
    the only instance published outside our control and Play cut it mid-claim.
 5. src/data/presets.ts:102 - the preset NAME. "Slow Wave" was itself the banned phrase sitting on a
    tappable chip. I took the Research Lead's alternative "Pulse Night" over reusing "Deep Pulse",
    which would have collided with the layer of that name one screen away.
 6. src/ui/sheets/PaywallSheet.tsx:252-255 - the "four with the strongest evidence" sentence, which
    the Research Lead vetoed as plainly false against our own badges. Replaced verbatim.

DECISION RECORDED: the preset ID stays 'slow-wave'. Only the display name moved. The id is a
persistence key - saved mixes and the last-preset restore are keyed on it - so renaming it is a data
migration, not a copy fix, and nothing about the claim requires it. If it is ever renamed it needs a
migration and that is a separate task.

Verified: npm run typecheck clean. npm test 266 passed / 266, 16 files, 4.4 s. **The two
deliberately-red standing-decision tests are now green, and they went green because the defect was
fixed rather than because the assertion was weakened** - the Senior Platform Engineer had already run
these exact replacement strings through both assertions and predicted 0 offenders with the qualifier
at index 0. They were right. That is the first time on this project that a test written against a
known defect has flipped to green by the defect being fixed.
NOT verified on a device. Nobody has seen this copy on a screen.

STILL OPEN AND STILL THE FOUNDER'S, unchanged by any of the above:
 - Standing decision 4's own wording in team/README.md, which hard-codes the same ranking claim I
   just deleted from the paywall. The Research Lead is right that the lesson is not to replace one
   ranking with another. I am not rewriting a standing decision on my own authority.
 - Whether Campfire becomes free. Lynn 2014 is untouched by Basner 2026, so fire is now the most
   robust primary study in the bibliography and the only Strong layer we charge for.
 - The quietloom_premium_forever reprice, which is the only deadline-bound item on the board.
