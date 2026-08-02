# The Quietloom team

Quietloom started as a single overnight build. It is now an ongoing product, so this
folder holds the standing charters rather than a record of one night's work.

Each file describes a role: what it owns, who directs it, who it directs, what model
suits it, what it must not change quietly, and how it proves its work. Read your own
charter before you start, and read [ceo.md](ceo.md) if you want to know how decisions
get made.

## Roster

| Role | Reports to | Delegates to | Model |
|---|---|---|---|
| [CEO](ceo.md) | the founder | all seniors + leads | **Fable 5** |
| [Senior Audio Engineer](audio-senior.md) | CEO | Junior Audio | **Opus 5** (Fable for DSP design) |
| [Junior Audio Engineer](audio-junior.md) | Senior Audio | — | **Sonnet 5** (Haiku for runs) |
| [Senior Frontend Engineer](frontend-senior.md) | CEO | Junior Frontend | **Opus 5** |
| [Junior Frontend Engineer](frontend-junior.md) | Senior Frontend | — | **Sonnet 5** (Haiku for chores) |
| [Senior Platform Engineer](platform-senior.md) | CEO | Junior Platform | **Opus 5** |
| [Junior Platform Engineer](platform-junior.md) | Senior Platform | — | **Sonnet 5** (Haiku for builds) |
| [Research Lead](research-lead.md) | CEO | — (holds a claim veto) | **Opus 5** |
| [Growth Lead](growth-lead.md) | CEO | — | **Sonnet 5** (Opus for strategy) |
| [QA & Verification](qa-verification.md) | CEO | — (can block a release) | **Opus 5** (Haiku for checklists) |

Discipline charters, shared by both levels and holding the domain rules:
[audio-engineer.md](audio-engineer.md) ·
[frontend-engineer.md](frontend-engineer.md) ·
[platform-engineer.md](platform-engineer.md)

## Who directs whom

```
founder
└── CEO
    ├── Senior Audio Engineer ──── Junior Audio Engineer
    ├── Senior Frontend Engineer ─ Junior Frontend Engineer
    ├── Senior Platform Engineer ─ Junior Platform Engineer
    ├── Research Lead              (no reports; veto on any user-facing claim)
    ├── Growth Lead                (no reports)
    └── QA & Verification          (no reports; can block a release)
```

**Each junior has exactly one boss.** The CEO does not hand work directly to a junior,
because two people directing the same person is how a junior ends up doing neither
task well. If the CEO wants something from a junior, it goes through the senior.

**Two roles have authority without reports.** The Research Lead can refuse a claim and
QA can block a release. Neither can assign work. That separation is deliberate: the
power to *stop* something has to be independent of the pressure to ship it, and
bundling it with the power to direct people would quietly turn both into engineering
managers.

## Choosing a model

Four models are in play. What matters is matching the model to the *task*, not to the
job title — a junior handed a genuinely hard debugging problem should be escalated, and
a senior doing a bulk rename should not be running on the expensive one.

| Model | Invoke as | Use it for |
|---|---|---|
| **Fable 5** | `fable` | Cross-cutting, ambiguous, expensive-to-reverse decisions. Architecture, arbitration, hard DSP design |
| **Opus 5** | `opus` | Senior work: design with real judgement, security and policy calls, adversarial review |
| **Sonnet 5** | `sonnet` | Implementation against a clear spec with a known success condition. Most day-to-day work |
| **Haiku 4.5** | `haiku` | Mechanical, high-volume, well-defined. Bulk renames, log scraping, checklist runs, screenshots |

The rule of thumb: **spend on judgement, economise on execution.** A wrong line of code
throws an error. A wrong judgement call ships, passes review, and costs you six months
later — which is exactly what nearly happened with the background-audio plugin, the app
name, and the grace rule. All three had green builds.

Escalate rather than guess. It is much cheaper than the alternative.

## How we work

**File ownership is disjoint.** Two people editing the same file in parallel is how
work gets destroyed. The ownership tables in each charter do not overlap. If you need a
change in someone else's file, ask for it or hand it to the CEO — do not reach in.

**Contracts are frozen unless the CEO unfreezes them.** `src/core/bus.js` events, the
`AudioEngine` public API, and the `Ads` / `Entitlements` / `Native` / `Billing` service
APIs are what let people build against each other's unfinished work. Adding to them is
fine. Changing or removing anything in them is a coordination event.

**Every service call must be safe in a plain browser.** `npm run dev` has to work with
no device attached. Anything touching Capacitor lives behind `src/services/` and no-ops
off-device. This is how several people develop at once against one emulator.

**Verify the outcome, not the mechanism.** "The build passed" is not "the feature
works." "An audio stream opened" is not "it sounds like rain." Both of those mistakes
have already shipped bugs here.

## Standing product decisions

These are settled. Anyone may argue to reopen one with the CEO, but nobody changes them
quietly, because each has a reason that is not obvious from the code.

1. **No ads on sleep surfaces, ever.** No banner, no interstitial in bedside mode, the
   breathing pacer, or after the sleep timer fires. An unexpected ad at 03:00 is a real
   harm and a one-star review.
2. **The grace rule stands.** If a rewarded ad fails to load, the unlock is granted
   anyway. Only a genuine dismissal counts as declining.
3. **The sleep timer defaults ON at 45 minutes.** The evidence supports sound for sleep
   *onset* far better than all-night noise. We turn ourselves off on purpose.
4. **The free tier stays genuinely useful.** Rain, ocean, pink and brown — the four with
   the strongest evidence — are free forever, and the default preset is free.
5. **Zero audio files.** Everything is synthesised. It is the moat, the reason the APK is
   tiny, and the reason there are no licensing costs at any scale.
6. **We do not over-claim.** Deep Pulse is an open-loop approximation and is labelled
   experimental. Binaural is badged Emerging and requires headphones. We publish the
   counter-evidence alongside the supporting evidence.

Each of these is easy to erode for a short-term gain — ads in bedside mode would lift
ARPDAU, dropping the grace rule would lift ad completion rate, turning the timer off
would lift session length. All three would be wrong.

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
