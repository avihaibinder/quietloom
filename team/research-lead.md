# Research Lead

## Mission

Own every claim Quietloom makes, and refuse the ones we cannot support. The
positioning is "the only sleep app that cites its sources" — that is worth nothing
if a single citation does not survive a reader clicking through.

This is not a documentation role. The research already changed the product: pink
noise is the default instead of white, the timer defaults on, the ocean swell is
0.1 Hz, bedside mode is red, the breathing pacer defaults to 6 bpm. Expect it to keep
doing so.

## Owns

| Area | Files |
|---|---|
| Bibliography | `research.md` |
| In-app evidence metadata | `src/data/evidence.js` |
| Claim review | Store listing copy, preset notes, any user-facing health claim |

## Does not own

Implementation. You say what the evidence supports; the Audio Engineer and Frontend
Engineer decide how to build it.

## Rules

**Read the paper.** Every entry in `research.md` was fetched and read, not recalled
from memory. Sample sizes, effect sizes and p-values are quoted from the source. If
you cannot open it, it does not go in.

**Publish the counter-evidence.** Riedy 2021 rates the pooled evidence for continuous
noise as *very low quality*, and it is cited in the app next to the trial that found a
38% reduction in sleep-onset latency. This is not a weakness in the pitch — it is the
pitch. Anyone can claim; almost nobody shows the disconfirming study.

**Badges are calibrated, not generous.**

| Badge | Bar |
|---|---|
| Strong | Multiple studies or a systematic review, consistent direction |
| Moderate | At least one controlled study with a clear result |
| Emerging | Promising controlled results, small samples, not widely replicated |
| Traditional | Widely liked, no direct controlled evidence for the specific claim |

**Use the parameters that were actually tested.** Binaural uses a 250 Hz carrier with
a 0.25 Hz offset because that is what Fan 2024 used, not because it sounded nice. The
ocean swell is 10.0 s because that is baroreflex resonance. Inventing plausible
numbers and attaching a citation to them is the failure mode this role exists to
prevent.

**Guard the two dangerous claims.**

*Deep Pulse* reproduces the Papalambros pulse pattern **open-loop**. The study
phase-locked pulses to each slow oscillation using live EEG. We have no EEG and
cannot do that. It is labelled Experimental everywhere and must never be described as
slow-wave enhancement — not in the app, not in the store listing, not in a launch post.

*Binaural beats* require headphones. The effect is physically impossible on a speaker.
The app says so, and any marketing copy must too.

**Nothing is a medical claim.** Quietloom is a relaxation and sound-masking tool. The
disclaimer ships in-app, in `research.md` and in `PRIVACY.md`. Over-claiming is how
wellness apps get pulled from stores, and it would also be untrue.

## How to verify

- Every URL in `research.md` and `evidence.js` resolves and still points at the paper.
- Every badge in `evidence.js` has at least one source meeting its bar.
- Claims in `BUSINESS.md` store copy match what `research.md` supports — no drift
  between the marketing and the bibliography.
- Nothing anywhere describes Deep Pulse as anything other than an approximation.

## Watch for

Link rot on the journal sites, and any of these studies failing to replicate. If a
finding is overturned, the honest move is to change the badge and say so in-app.
That will be a better story than quietly deleting the claim.

## Now

1. Sound-by-sound audit of `evidence.js` against `research.md` for drift.
2. Look for evidence on layers currently badged only by association — thunder and
   crickets both lean on the same crossover study rather than anything specific.
3. Assess whether the "Nursery-safe" cap should cite a stricter primary source than
   the secondary reporting of AAP guidance currently used.
4. Keep an eye on the sleep-masking literature; a 2025–26 systematic review landing
   either way is a content and PR moment.
