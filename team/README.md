# The Quietloom team

Quietloom started as a single overnight build. It is now an ongoing product, so
this folder holds the standing charters rather than a record of one night's work.

Each file describes a role: what it owns, what it must not silently change, how it
proves its work, and what is on its plate next. Read your own charter before you
start, and read `ceo.md` if you want to know how decisions get made.

## The roles

| Role | Owns | File |
|---|---|---|
| CEO | Direction, priorities, integration, the final quality gate | [ceo.md](ceo.md) |
| Audio Engineer | The generative engine — the actual moat | [audio-engineer.md](audio-engineer.md) |
| Frontend Engineer | Everything the user sees and touches | [frontend-engineer.md](frontend-engineer.md) |
| Platform & Monetization Engineer | Android shell, ads, billing, build pipeline | [platform-engineer.md](platform-engineer.md) |
| Research Lead | Every claim the app makes, and refusing the ones we cannot support | [research-lead.md](research-lead.md) |
| Growth Lead | Store presence, launch, revenue, the numbers that matter | [growth-lead.md](growth-lead.md) |
| QA & Verification | Proving things work by using them, not by reading them | [qa-verification.md](qa-verification.md) |

## How we work

**File ownership is disjoint.** Two people editing the same file in parallel is how
work gets destroyed. The ownership tables in each charter do not overlap. If you
need a change in someone else's file, ask for it or hand it to the CEO to
integrate — do not reach in.

**Contracts are frozen unless the CEO unfreezes them.** `src/core/bus.js` events,
the `AudioEngine` public API, and the `Ads` / `Entitlements` / `Native` / `Billing`
service APIs are what let people build against each other's unfinished work. Adding
to them is fine. Changing or removing anything in them is a coordination event.

**Every service call must be safe in a plain browser.** `npm run dev` has to work
with no device attached. Anything touching Capacitor lives behind `src/services/`
and no-ops off-device. This is not a nicety — it is how five people develop at once
against one emulator.

**Verify the outcome, not the mechanism.** "The build passed" is not "the feature
works." "An audio stream opened" is not "it sounds like rain." Both of those
mistakes have already shipped bugs here. Your charter has a verification section;
it is the part that actually matters.

## Standing product decisions

These are settled. Anyone may argue to reopen one with the CEO, but nobody changes
them quietly, because each has a reason that is not obvious from the code.

1. **No ads on sleep surfaces, ever.** No banner, no interstitial in bedside mode,
   the breathing pacer, or after the sleep timer fires. An unexpected ad at 03:00 is
   a real harm and a one-star review.
2. **The grace rule stands.** If a rewarded ad fails to load, the unlock is granted
   anyway. Only a genuine dismissal counts as declining. Nobody gets locked out of
   falling asleep because an ad server had a bad night.
3. **The sleep timer defaults ON at 45 minutes.** The evidence supports sound for
   sleep *onset* far better than all-night noise. We turn ourselves off on purpose.
4. **The free tier stays genuinely useful.** Rain, ocean, pink and brown — the four
   with the strongest evidence — are free forever, and the default preset is free.
5. **Zero audio files.** Everything is synthesised. It is the moat, the reason the
   APK is tiny, and the reason there are no licensing costs at any scale.
6. **We do not over-claim.** Deep Pulse is an open-loop approximation and is labelled
   experimental. Binaural is badged Emerging and says headphones are required. We
   publish the counter-evidence alongside the supporting evidence.

## Where everything lives

```
research.md            The bibliography, and the product spec in disguise
BUSINESS.md            Revenue model and the go-live checklist
HANDOFF.md             Current state: what is verified, what is not
PRIVACY.md             Publishable policy, placeholders to fill
README.md              Dev setup and the environment gotchas
UI-WIRING.md           How the UI is wired
MONETIZATION-WIRING.md How ads and billing are wired
team/                  You are here
```
