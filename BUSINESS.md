# Quietloom — Business, Monetisation and Go-Live

This is the commercial half of the project. The engineering half is in `README.md`, and the
scientific half is in `research.md`. This document is written for you, the owner: you can read code,
but you have never shipped an app that makes money. Everything here is meant to be actionable, and
where I am guessing I say so.

The single most important sentence in this file: **the app currently earns exactly $0, and will
continue to earn exactly $0 until you complete section 3.** It ships with Google's public test ad
unit IDs. They always fill, they look real, and they pay nothing. Swapping them is a fifteen-minute
job gated behind a few slower administrative steps.

---

## 1. What Quietloom is, and why it can make money

### The product in one paragraph

Quietloom is an Android sleep-sounds app in which every sound is synthesised in real time on the
device. There are no audio files in the project at all. Rain is filtered noise shaped by a
stochastic droplet model; ocean is a 0.1 Hz swell envelope over band-limited noise; fire is
crackle transients over a low rumble. All of it is multiplied by a slow 1/f amplitude envelope,
which is the difference between "a noise generator" and "rain". Four sounds are free forever, the
rest unlock either by watching one rewarded video (good until 11:00 the next morning) or by a
one-time purchase.

### The market

Sleep and wellness is one of the few consumer app categories that reliably converts. Three reasons,
all of which apply here:

**People with a sleep problem are already spending money on it.** They have bought blackout
curtains, magnesium, a weighted blanket and probably a physical white-noise machine. A $4.99 app or
a thirty-second video is a trivially small ask against that baseline. Compare this to, say, a photo
utility, where the user has no established willingness to pay for anything.

**Usage is nightly and it is long.** A sleep app gets opened every single night by a retained user,
and each session lasts tens of minutes. That is an unusually good shape for ad monetisation: high
frequency, high session duration, and a natural daily reset. Most app categories have to fight for
one of those three.

**The intent is captured at a moment of low friction.** Someone opening a sleep app at 23:40 is not
comparison shopping. If your free tier does the job, they stay.

The flip side is that everyone knows this. The category is brutally saturated. Calm and Headspace
are venture-scale businesses with real marketing budgets; BetterSleep, Rain Rain, Portal, Sleep
Sounds, Noisli and a hundred others already own the obvious search terms. You are not going to win
"sleep sounds" as a search term. You need a wedge, and you have one.

### The moat, such as it is

Three things about Quietloom are genuinely hard for an incumbent to copy quickly.

**Nobody else cites their sources.** Search the Play Store for sleep apps and you will find a
thousand claims — "scientifically designed", "clinically proven", "engineered by sleep experts" —
attached to precisely zero references. Quietloom puts an evidence badge on every layer (Strong /
Moderate / Emerging / Traditional) and an info card that links to the actual paper on PubMed or
Frontiers. It also ships the *counter*-evidence: the white-noise card links to Riedy 2021, the
systematic review that rated the evidence for continuous noise as "very low". That is a genuinely
unusual product decision and it is the whole story you have to tell.

It shows up in the defaults, which is what makes it credible rather than decorative:

- Pink noise is the default, not white, because Zhou 2012 is the strongest noise result available
  and it used pink. Almost every competitor defaults to white.
- The sleep timer defaults **ON at 45 minutes**. The evidence supports sound for sleep *onset* far
  better than it supports eight hours of continuous noise. Quietloom is the only sleep app I am aware of
  that is designed to turn itself off. This costs us ad impressions and we do it anyway, which is
  precisely why anyone will believe the rest of it.
- The ocean swell is locked to exactly ten seconds — 0.1 Hz — so the waves are a six-breaths-per-
  minute pacer at the resonance frequency of the baroreflex. You can follow it without opening
  another screen.
- Bedside mode is deep red on near-black rather than white, because red light suppresses melatonin
  far less than blue.
- There is a nursery-safe volume cap based on WHO night-noise limits and AAP guidance on infant
  sound machines. Essentially nobody ships this.

**Zero content cost, forever.** Every competitor either licensed a sound library or recorded one.
That is a fixed cost, an ongoing licence risk, and a reason their APKs are 80–300 MB. Quietloom's audio
is a few kilobytes of JavaScript. Your gross margin on this app is effectively 100% minus Google's
cut, and it stays that way at any scale.

**Synthesis is a real feature, not a technicality.** A recording loops. Once a user notices the loop
point they cannot un-notice it, and the app is ruined for them. This is one of the single most
common one-star complaints in the entire category — go read the reviews of any competitor and count
how many mention looping. Quietloom physically cannot loop. That is a review-driven, word-of-mouth
advantage that compounds.

### The honest risks

I would rather you know these now than discover them in week three.

**Discovery is the whole game and you have no budget.** Building the app was the easy part. The
median Play Store app gets under a thousand lifetime installs. Everything in section 6 is
zero-budget distribution, and zero-budget distribution is high-variance: it either works
spectacularly once or it does nothing. Plan for it doing nothing and be delighted if it does not.

**The research angle is a niche appeal.** The people who are moved by "this app cites Zhou 2012" are
a small, specific, over-represented-on-Hacker-News slice of the population. Most people buying a
sleep app want it to sound nice. The good news is that this slice is also the slice that writes
blog posts and shares links, so it is a disproportionately good *first* audience even if it is a bad
*only* audience.

**Cited claims invite scrutiny.** If you lean on the science, someone will check. The citations in
`research.md` were actually fetched and read, the badges are conservative, and the app ships the
negative review alongside the positive trials — so scrutiny should go well. But never let anyone
soften the language into "clinically proven". That is both false and a Play Store policy violation.

**Google can turn you off.** AdMob accounts get suspended for invalid traffic, and a suspension
means you lose the revenue and often the account. Never tap your own ads, never ask anyone to tap
ads, and never test with real ad unit IDs on your own device without registering it as a test
device. Section 3 covers this.

**A young codebase has young-codebase risks.** There is no crash reporting, no server, no
analytics, and the billing module is a stub. Ship the ads first, prove there is an audience, and
only then spend money on the rest.

---

## 2. How the money actually flows

### The vocabulary, once

**eCPM** — effective cost per mille, meaning revenue per one thousand ad impressions. If your
rewarded video eCPM is $10, you earn one cent every time someone watches one. eCPM is not something
you set; it is what the auction produces, and it varies enormously by ad format, by country and by
season. A user in the United States, Germany or Japan is worth roughly ten to thirty times a user in
a low-income market for the same impression. Advertising rates also swing about 30% over the year,
peaking in Q4 and bottoming out in January.

**Impression** — one ad shown. **Fill rate** — the share of ad requests that get an ad back;
with AdMob mediation off and a general-audience app, expect this to be high. **ARPDAU** — average
revenue per daily active user, the number that actually tells you whether the app is working.

### The four revenue lines, in plain terms

**Rewarded video → the night pass. This is the primary engine.** The user taps "Unlock tonight",
watches a video of roughly thirty seconds, and every premium layer opens until 11:00 the next
morning. Then it expires and they have to do it again tomorrow night.

Rewarded video is the highest-eCPM format in mobile advertising, typically two to five times a
banner and often more than an interstitial, for three reasons: it is opt-in, so completion rates are
high; it is full-screen video, which advertisers pay a premium for; and the reward is proof the user
was actually present. Advertisers are buying attention and this is the only format where they
demonstrably get it.

The night-pass design is doing specific work. An 11:00 expiry means the unlock is always still valid
when the user wakes up (so it never feels like it was snatched away mid-sleep) but is always expired
by the following bedtime (so tomorrow night there is a fresh, voluntary, non-annoying reason to
watch another one). A retained user generates one high-value impression per night, indefinitely,
without ever being interrupted. Compare that to an interstitial, which generates one impression and
some resentment.

**Interstitial — capped at one per day, on app open.** Full-screen, unskippable for a few seconds,
decent eCPM, and universally hated. The code enforces a hard limit of one per local calendar day,
and it only records the day *after* the SDK confirms the ad was displayed, so a failed load does not
burn the slot. This cap costs real money — you could easily show three or four a day — and it is
worth it. In a sleep app, an ad that fires while the user is trying to wind down is not a minor
irritation, it is the reason they uninstall.

**Banner — mixer screen only.** Low eCPM, but it costs nothing to run and it accumulates. It is
confined to the mixer, where the user is actively fiddling with sliders and is not trying to fall
asleep.

**Zero ads in bedside mode, in the breathing pacer, or on any sleep surface.** This is a product
rule encoded in the code and it is not negotiable. An unexpected loud advertisement at 23:50 is a
real harm to the person you are supposed to be helping, and it is also the fastest route to
one-star reviews in a category where reviews are everything.

**In-app purchase — "Premium forever", `quietloom_premium_forever`, $4.99.** Every layer, every scene,
no ads, forever. The scaffold exists in `src/services/billing.ts` but is currently a stub that
reports "coming soon", so the paywall gracefully falls back to offering the free rewarded unlock.
Wiring it is step 9 of the checklist.

One-time purchases in this category convert at roughly 0.3–1% of users. It will not be your biggest
line early on, but it has two properties that make it worth having: it monetises the users who hate
ads (who are otherwise worth nothing to you and who leave bad reviews), and it produces a lump of
cash on day one rather than a trickle. Note that Google takes 15% of the first $1,000,000 you earn
in a year, not 30% — so a $4.99 sale nets you about $4.24.

### Revenue math — illustrative, not a forecast

Everything below is an **estimate built from published category ranges**. It is arithmetic, not a
prediction. I have shown every step so you can substitute your own assumptions when real numbers
arrive. Read the low column as the likely one: most apps land at or below the low end, and a great
many never reach any of these install counts at all.

**Step 1 — eCPM assumptions.** Ranges for a general-audience sleep/wellness app with mixed
worldwide traffic:

| Format | Low | Middle | Good |
|---|---:|---:|---:|
| Rewarded video | $4 | $9 | $18 |
| Interstitial | $2 | $4 | $9 |
| Banner | $0.25 | $0.60 | $1.40 |

The "good" column mostly means a traffic mix skewed heavily to the US, UK, Canada, Australia,
Germany and Japan. If your audience turns out to be predominantly in lower-CPM markets, halve the
low column.

**Step 2 — installs become daily actives.** Retention is what converts an install into revenue.
Plausible figures for a sleep app, which retains better than average because usage is habitual:

| | Typical range |
|---|---|
| Day 1 retention | 25–35% |
| Day 7 retention | 10–15% |
| Day 30 retention | 4–8% |

Take D30 of 5% as the middle. Steady-state daily actives settle at roughly 4–6% of cumulative
installs once a cohort matures. So 1,000 installs is about 50 DAU, 10,000 installs about 500 DAU,
100,000 installs about 5,000 DAU — and those numbers *decay* if new installs stop.

**Step 3 — revenue per daily active.** Building up monthly revenue for 1,000 DAU, using the middle
eCPM column:

| Line | Assumption | Impressions / month | eCPM | Revenue |
|---|---|---:|---:|---:|
| Rewarded | 0.5 views per user per day (not everyone wants premium layers, not every night) | 15,000 | $9 | $135 |
| Interstitial | 0.8 per user per day (capped at 1, not every open triggers) | 24,000 | $4 | $96 |
| Banner | 3 per user per day (mixer screen only, ~3 min at a 60s refresh) | 90,000 | $0.60 | $54 |
| **Total** | | | | **~$285 / month per 1,000 DAU** |

That is an **ARPDAU of about $0.0095**, which sits squarely inside the $0.005–$0.02 band that is
normal for this category. The internal consistency is a good sign that the assumptions are not
fantasy.

**Step 4 — put it together.** Monthly ad revenue, plus one-time IAP at a 0.5% conversion rate on
installs, at $4.24 net per sale:

| Cumulative installs | ≈ DAU | Ad revenue at $0.003 ARPDAU | at $0.0095 | at $0.02 | One-time IAP |
|---|---:|---:|---:|---:|---:|
| 1,000 | ~50 | $4.50 / mo | $14 / mo | $30 / mo | ~$21 |
| 10,000 | ~500 | $45 / mo | $143 / mo | $300 / mo | ~$212 |
| 100,000 | ~5,000 | $450 / mo | $1,425 / mo | $3,000 / mo | ~$2,120 |

**How to read this table honestly.**

At 1,000 installs you are making beer money and you may never even reach AdMob's $100 payout
threshold — Google holds the balance until you cross it. Treat 1,000 installs as *validation*, not
income: it is enough to see whether retention and rewarded completion look healthy, which is what
tells you whether to invest more.

At 10,000 installs you have a real, small, self-sustaining product. This is an achievable outcome
for a well-executed zero-budget launch with one good Hacker News or Reddit day behind it.

At 100,000 installs you have something worth taking seriously — and you almost certainly did not get
there without either a genuine viral moment or paid acquisition. Do not plan around it.

The single biggest lever in every row is not eCPM. It is retention, because retention sets DAU and
DAU multiplies every other number in the table. That is why section 7 puts retention work first.

---

## 3. GO LIVE CHECKLIST

This is the section that turns $0 into a number. Work through it in order. Steps marked
**[IDENTITY]** need your legal name or an ID document; steps marked **[MONEY]** cost money; steps
marked **[SLOW]** have a waiting period you cannot compress, so start them first.

### Do this first, because it has a two-week clock on it

**Step 0. [MONEY] [IDENTITY] [SLOW] Create your Google Play developer account today.**

Go to <https://play.google.com/console/signup>, pay the **$25 one-time** registration fee, and
complete identity verification. Use a personal account unless you already have a registered company;
an organisation account additionally requires a D-U-N-S number, which takes days to obtain.

Then read this carefully, because it is the biggest schedule risk in the project. **Personal
developer accounts created after November 2023 must run a closed test with at least 12 testers who
stay opted in continuously for 14 days before Google will let you apply for production access.**
Twelve real Google accounts, opted in, for two solid weeks. If you start recruiting testers on
launch day you have just added a fortnight to your timeline. Start now: create the account, create
the app entry, get a debug build into a closed testing track, and message twelve friends. Everything
else in this checklist can happen while that clock runs.

### AdMob

**Step 1. [IDENTITY] Create an AdMob account** at <https://admob.google.com>. It attaches to a
Google account and needs your real name, address and tax information (a W-8BEN or W-9 equivalent) to
pay you. AdMob pays out monthly once your balance passes **$100**.

**Step 2. Create the app in AdMob.** *Apps → Add app → Android.* If the app is not yet on Google
Play, choose "No, it is not listed yet" — you can link it to the Play listing later, and you should,
because linked apps get better optimisation data. Name it Quietloom.

AdMob gives you an **application ID** that looks like `ca-app-pub-1234567890123456~9876543210`. Note
the **tilde**. Write it down.

**Step 3. Create three ad units.** In your new app: *Ad units → Add ad unit.* Create exactly these
three, and give them these names so the AdMob reports are readable later:

| Ad unit name | Format | Settings |
|---|---|---|
| `quietloom-banner-mixer` | Banner | Leave the auto-refresh at 60 seconds |
| `quietloom-interstitial-open` | Interstitial | Default |
| `quietloom-rewarded-nightpass` | Rewarded | Reward item: name `nightpass`, amount `1` |

Each gives you an **ad unit ID** that looks like `ca-app-pub-1234567890123456/1122334455`. Note the
**slash**. The half before the separator is the same publisher ID in all four values; only the
separator and the suffix differ. Mixing up `~` and `/` is the most common go-live mistake and it
produces ads that silently never load.

**Step 4. Put your real IDs into the code.** Two edits, in two files.

**4a. `src/services/ads.ts`, in the `AD_UNITS` block at the top of the file.** It currently uses
the library's `TestIds` constants, which are Google's public test units:

```ts
export const AD_UNITS = {
  banner: TestIds.ADAPTIVE_BANNER,
  interstitial: TestIds.INTERSTITIAL,
  rewarded: TestIds.REWARDED,
};
```

becomes:

```ts
export const AD_UNITS = {
  banner: 'ca-app-pub-YOURPUBID/YOURBANNERUNIT',
  interstitial: 'ca-app-pub-YOURPUBID/YOURINTERSTITIALUNIT',
  rewarded: 'ca-app-pub-YOURPUBID/YOURREWARDEDUNIT',
};
```

Set `TEST_MODE = false` on the line below at the same time. While it is `true` the unit IDs above
are ignored in favour of the test ones, so changing one without the other does nothing.

**4b. `app.json`, the `react-native-google-mobile-ads` plugin block.** Replace both test
application IDs — these use a tilde, not a slash:

```json
[
  "react-native-google-mobile-ads",
  {
    "androidAppId": "ca-app-pub-3940256099942544~3347511713",
    "iosAppId": "ca-app-pub-3940256099942544~1458002511"
  }
]
```

becomes your real app IDs. The plugin writes them into the generated manifest at prebuild time.
Do **not** try to edit the manifest directly — see the gotcha below. The Google Mobile Ads SDK
crashes the app at launch if the application ID is missing entirely.

> **The gotcha that will get you.** `android/` is *generated*. `npx expo prebuild` rewrites it from
> `app.json`, so any hand-edit to `AndroidManifest.xml` or a Gradle file is silently discarded on
> the next build. Native configuration belongs in `app.json` or a config plugin. (This replaces the
> old Capacitor trap, which was the exact opposite: there, `android/` held a compiled copy of the
> web app and you had to remember to re-sync after every source edit.)

**Step 5. Test with real IDs safely — register your device as a test device.** Once `TEST_MODE` is
`false` you are requesting live ads. Tapping one yourself, even accidentally, is invalid traffic,
and repeated invalid traffic gets AdMob accounts suspended. Before you install a release build on
your own phone, run it once, find the line in `adb logcat` that reads
`Use RequestConfiguration.Builder.setTestDeviceIds(Arrays.asList("XXXXXXXX"))`, then add your device
in AdMob under *Settings → Test devices*. Confirm you see the "Test Ad" label on the ad itself. Never
click your own live ads.

**Step 6. Publish `app-ads.txt` — do not skip this, it is worth real money.**

`app-ads.txt` is a plain text file hosted on your own website that publicly declares which ad
networks are authorised to sell your app's inventory. It exists to stop fraudsters spoofing your app
and selling fake impressions. Programmatic buyers — which is a large share of the demand that sets
your eCPM — will substantially discount or refuse to bid on inventory from an app with no verified
`app-ads.txt`. Publishers routinely see meaningful revenue differences from this one file, and it
takes ten minutes.

1. AdMob shows you the exact line under *Apps → app-ads.txt*. It looks like:
   ```
   google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0
   ```
2. Host it as a plain text file at the **root** of a domain you control, reachable at
   `https://yourdomain.com/app-ads.txt`. GitHub Pages, Netlify, Cloudflare Pages and Vercel all do
   this for free. The same site can host your privacy policy.
3. In your Play Store listing, set the **Website** field to exactly that domain. AdMob finds the
   file by reading the developer website from your store listing — if the field is empty or points
   somewhere else, the crawler will never find the file.
4. Wait. AdMob re-crawls roughly every 24 hours and the status in the console changes from "not
   found" to "authorised". Check back the next day.

**Step 7. [COMPLIANCE GAP] Implement the EEA consent form.** `src/services/ads.ts` does not
currently call Google's User Messaging Platform. Under the GDPR and Google's own EU user consent
policy, you must collect consent before serving personalised ads to users in the EEA, the UK or
Switzerland. Without it you are non-compliant, *and* you lose money: without consent Google serves
only non-personalised ads to that traffic at a much lower eCPM.

Configure the consent form in AdMob under *Privacy & messaging → GDPR*, then call the UMP API
before `mobileAds().initialize()` in `Ads.init()`. `react-native-google-mobile-ads` bundles it as
`AdsConsent` (`requestInfoUpdate()`, `loadAndShowFormIfRequired()`, `reset()`). This is a small,
contained change and it belongs before your first production release. Note that the app already sets
`maxAdContentRating: G`, which keeps the ad inventory tame — keep that.

### Google Play Console

**Step 8. Complete the store listing and all the policy forms.** In Play Console, *Create app*, then
work through everything with a red mark next to it. The parts that matter:

- **Main store listing** — title, short description, full description (all in section 4 below), a
  512×512 icon, a 1024×500 feature graphic and at least two phone screenshots. Set the **Website**
  field to the domain hosting `app-ads.txt`.
- **Privacy policy URL** — under *Policy → App content*. `PRIVACY.md` in this repo is ready to
  publish; it needs your name, email and a date, and it needs to live at a public URL. A file in a
  private repository does not count.
- **Data safety form** — declare that the app collects a **Device or other ID** for **Advertising
  or marketing**. Declare no other collection, because there is none. Make sure this matches
  `PRIVACY.md` word for word in substance; Google compares them and a mismatch is a common
  rejection.
- **Content rating questionnaire** — answer honestly; Quietloom should come out as Everyone / PEGI 3.
- **Target audience and content** — set this to **13+ or 18+**. Do *not* declare children as a
  target audience. It is tempting because of the nursery-safe cap, but declaring a child audience
  pulls the app into Google Play's Families policy, which forbids standard AdMob serving and
  requires a certified ads SDK with a different configuration. The nursery cap is a feature for a
  *parent* operating the phone. Keep the declared audience adult.
- **Ads declaration** — yes, this app contains ads.
- **Health claims** — nowhere in your listing may you say Quietloom treats, cures or is clinically
  proven to fix insomnia. Descriptive and cited is fine. Therapeutic claims will get the listing
  rejected and are also not true.

**Step 9. [SECURITY] Generate an upload keystore and configure release signing.**

Every Android release must be signed. Generate the key once and never lose it:

```bash
keytool -genkeypair -v \
  -keystore quietloom-upload.jks \
  -keyalg RSA -keysize 4096 -validity 10000 \
  -alias quietloom-upload
```

On Windows, `keytool.exe` lives at `C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe`.
You will be asked for a keystore password, a key password and some identity fields — the identity
fields are not shown to users, so anything sane is fine.

**Store `quietloom-upload.jks` and both passwords somewhere you will still have them in five years, and
never commit the file to source control.** Because Play App Signing holds the real distribution key
on Google's side, a lost *upload* key can be reset by contacting Google, but it is a slow and
irritating process. Back it up now.

Create `android/keystore.properties` (add it to `.gitignore` alongside the `.jks`):

```properties
storeFile=C:/secure/quietloom-upload.jks
storePassword=…
keyAlias=quietloom-upload
keyPassword=…
```

Then add signing to `android/app/build.gradle`. Insert this above the existing `buildTypes` block
and amend the `release` type, which currently has only `minifyEnabled` and `proguardFiles`:

```gradle
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    signingConfigs {
        release {
            if (keystorePropertiesFile.exists()) {
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

**Step 10. Build the release bundle.** Google Play requires an Android App Bundle (`.aab`), not an
APK.

```bash
npx expo prebuild --platform android
cd android
./gradlew bundleRelease
```

The bundle appears at `android/app/build/outputs/bundle/release/app-release.aab`. Upload that.

Two things to remember on every subsequent release: bump `version` and `android.versionCode` in
`app.json` (Play rejects a duplicate `versionCode`), and re-run `expo prebuild` after any change to
`app.json` — `android/` is generated, so an un-prebuilt change simply is not in the bundle. If
Gradle fails with `PKIX path building failed`, that is the Norton truststore issue — see
`README.md`.

**Step 11. Wire real in-app purchases.** Do this *after* the app is live and you can see whether
anyone is asking for it. It is the lowest-value item on this list and the fiddliest.

1. Install the library and rebuild the native project:
   ```bash
   npx expo install react-native-iap
   npx expo prebuild --platform android
   ```
   It is a native module, so it needs a dev build — it will not run in Expo Go.
2. In Play Console, go to *Monetize → Products → In-app products → Create product*. Product ID
   **`quietloom_premium_forever`** (this string must match exactly — it is `Billing.PRODUCT_ID` in the
   code), type **managed product** (one-time, not a subscription), price **$4.99**, then **activate
   it**. Note that Play will not let you create in-app products until you have uploaded a build to
   some track, so step 10 comes first.
3. Add yourself under *Setup → License testing* so you can make test purchases without being
   charged. Real purchase flows only work for a build installed *from Play* (internal testing track
   is fine) and signed with the upload key — you cannot test billing from a local debug APK.
4. Implement `src/services/billing.ts`. **Almost all of this work is already done for you.** The
   module is a scaffold shaped exactly like the finished thing, and it contains three comment
   blocks marked `TODO(billing) 1 of 3 — INITIALISE`, `2 of 3 — PURCHASE` and `3 of 3 — RESTORE`.
   Each one contains the actual `react-native-iap` code, commented out, ready to paste in. Those
   three blocks are the entire job. One note from the scaffold that will save you an hour: once
   billing is live, `PRICE_DISPLAY` should be overwritten at runtime with the localised price the
   store reports rather than left as the hardcoded `'$4.99'`.

   The public API is a **frozen contract** — `src/ui/sheets/PaywallSheet.tsx` branches on every one of these:

   | Member | Contract |
   |---|---|
   | `PRODUCT_ID` | `'quietloom_premium_forever'`. Must match the Play Console product ID exactly. |
   | `PRICE_DISPLAY` | Display string. Replace at runtime with the store's localised price. |
   | `init()` | `async`, must never throw. Called once at boot from `App.tsx`. |
   | `isAvailable()` | Synchronous boolean, currently `store !== null`. While `false` the paywall shows "Coming soon — the free unlock works tonight" instead of a dead button. |
   | `purchasePremium()` | Resolves `{ ok, reason?, productId? }`. |
   | `restore()` | Resolves `{ ok, reason? }`. Required by Play policy once IAP ships. |

   Failure reasons come from the closed `BILLING_REASONS` set exported by the module —
   `unavailable`, `cancelled`, `already-owned`, `nothing-to-restore`, `error`. Do not invent new
   ones; the UI only understands these.

   On `{ ok: true }` the paywall calls `Entitlements.setPremium(true)`, which permanently unlocks
   every layer and — via `Ads.setAdsDisabled(true)` — kills all advertising for that user.

5. **[CRITICAL] Confirm the dev backdoor is absent from the release bundle.**
   `src/services/billing.ts` ends with a `__grantPremiumForTesting()` method and a
   `globalThis.__quietloom.grantPremium()` handle, added so the premium UI path could be demoed
   without a Play Console. Anyone who can attach a debugger to a build that still contains it can
   unlock everything for free, permanently, with no ads.

   Both are gated on `__DEV__`, which Metro replaces with the literal `false` in a production
   build, so the block is dead code and gets stripped. That is the intended protection — but
   verify it rather than trust it, because the cost of being wrong is every paid layer given away.
   This is on the pre-flight checklist below for a reason.

**Step 12. Roll out.** Push to internal testing, then closed testing (this is where the twelve
testers from step 0 come in), then a staged production rollout starting at 20%. Watch the crash-free
rate in Play Console vitals for 48 hours before going to 100%. If the crash rate is above about 1%
Google will start suppressing you in search.

### The five-minute pre-flight, before every production upload

1. `AD_UNITS` in `src/services/ads.ts` contains no `3940256099942544` and no `TestIds`.
2. `TEST_MODE` in `src/services/ads.ts` is `false`.
3. The `react-native-google-mobile-ads` app IDs in `app.json` contain no `3940256099942544`, and
   use `~` not `/`.
4. `__quietloom` is **absent from the release bundle**. Prove it rather than assume it:
   `npx expo export --platform android --output-dir /tmp/rel` then
   `grep -r "__quietloom" /tmp/rel` must return nothing.
5. `android.versionCode` in `app.json` has been incremented.
6. `npx expo prebuild --platform android` was run **after** all of the above.
7. `app-ads.txt` shows "authorised" in AdMob.

---

## 4. Store listing copy — ready to paste

### App title (30 characters max)

```
Quietloom: Pink Noise & Sleep
```

25 characters. The title is the single heaviest ASO signal on Google Play, so it carries a keyword
rather than being purely a brand. Alternatives if you prefer: `Quietloom — Sleep Sounds & Noise` (28) or
`Quietloom: Sleep Sounds, No Loop` (28).

### Short description (80 characters max)

```
Sleep sounds generated live, never looping — with the research behind each one.
```

78 characters. This is the second-heaviest ASO field and it is what appears under the icon in search
results. It leads with the two differentiators.

### Full description

```
Every sound in Quietloom is generated live on your phone. There are no recordings, so nothing
ever loops — and once you have noticed a loop point in a sleep app, you cannot un-notice it.

Quietloom is also the only sleep app we know of that cites its sources. Tap the info dot on any
sound and you get the actual peer-reviewed study, with an honest badge for how strong the
evidence really is: Strong, Moderate, or Emerging. We link the research that disagrees with
us too.

WHY PINK, NOT WHITE
Most sleep apps default to white noise. The best available evidence is for pink noise: in a
40-person study, steady pink noise made brain activity more synchronised and significantly
increased the proportion of stable sleep time. So pink is our default. White is still there
if you want it — with a card explaining that a systematic review of 38 studies rated the
evidence for continuous noise as low quality. You should know that.

THE TIMER IS ON BY DEFAULT
Quietloom is designed to turn itself off after 45 minutes. The evidence supports sound for
falling asleep far better than it supports eight hours of noise. Most apps want to run all
night. We think that is backwards, and the default reflects it.

THE WAVES ARE A BREATHING PACER
The ocean swell is locked to exactly ten seconds — 0.1 Hz. Breathe in as the wave rises and
out as it falls, and you are breathing at six breaths per minute, the resonance frequency of
the baroreflex, where heart rate variability peaks. There is a dedicated breathing screen
too, defaulting to coherent breathing rather than the more fashionable 4-7-8, because the
evidence for six breaths a minute is better.

WHAT IS IN THE BOX
· Rain, from a light patter to a downpour, with distant thunder
· Ocean swells at a true 0.1 Hz
· A campfire — in one study, fire lowered blood pressure only when you could hear it
· Wind, night crickets
· Pink, brown and white noise
· Binaural beats at the exact frequencies that were actually tested — headphones required,
  because the effect physically cannot happen on a speaker
· Deep Pulse: rhythmic pink-noise pulses modelled on a slow-wave enhancement protocol,
  clearly labelled Experimental
· Six curated presets built from element combinations that appear in the research
· Layer anything with anything and save your own mixes

BEDSIDE MODE IS RED
Because light suppresses melatonin and blue light suppresses it far more. If this app is the
last thing you look at, it should be the least disruptive thing you look at. Deep red and
amber on near-black, with a large clock.

SAFE VOLUME, INCLUDING A NURSERY CAP
The WHO recommends keeping continuous bedroom sound below 30 dB. Guidance for infant sound
machines is stricter still: at or below 50 dB, at least two metres from the crib, never at
maximum. Quietloom has a volume guide built in and a nursery-safe cap that hard-limits output.
Almost nobody ships this. We think that is strange.

TINY, AND IT WORKS OFFLINE
No audio files means a very small download and a sound engine that works with no connection
at all.

FREE, AND HONESTLY FREE
Rain, ocean, pink noise and brown noise are free forever — those are four of the five with
the strongest evidence behind them. The rest unlock for the night by watching one short
video, or permanently with a single purchase. No subscription. No ads in bedside mode, no
ads in the breathing screen, and no ads on any sleep surface, ever.

NOT A MEDICAL DEVICE
Quietloom is a relaxation and sound-masking tool. It is not a medical device and it does not
diagnose, treat, cure or prevent any condition. Sample sizes in this literature are small,
effects vary a lot between individuals, and we tell you that inside the app. If you have a
persistent sleep problem, please talk to a doctor.
```

### Screenshots — suggested list, in order

Play shows the first two or three in search results, so they carry most of the weight. Put a short
caption across the top of each image; screenshots with text overlays convert measurably better than
bare captures.

1. **The mixer with several layers active.** Caption: *"Every sound generated live. Nothing ever
   loops."* This is your hero shot.
2. **An evidence card open, showing a badge and the study link.** Caption: *"Tap any sound. See the
   actual study."* This is the differentiator and it must be in the first three.
3. **The pink-noise card, with the badge and the Zhou citation visible.** Caption: *"Pink, not white
   — here is why."*
4. **Bedside mode**, deep red clock on black. Caption: *"Red, because blue light suppresses
   melatonin."*
5. **The ocean scene with the swell visualiser.** Caption: *"Waves at 0.1 Hz. Breathe with them."*
6. **The breathing pacer** mid-cycle. Caption: *"Six breaths a minute. The one with the best
   evidence."*
7. **The timer set to 45 minutes.** Caption: *"On by default. Designed to turn itself off."*
8. **The volume guide / nursery-safe cap.** Caption: *"A safe-volume cap for the nursery."*

For the **feature graphic** (1024×500), use the visualiser artwork with the words "Every sound
synthesised. Every claim cited." Keep text away from the edges — it gets cropped in some placements.

---

## 5. ASO — which keywords to fight for

Google Play's search indexes your **title**, **short description** and **full description**, and
unlike the App Store there is no separate keyword field. Repetition in the long description does
help, within reason; keyword stuffing gets you suppressed.

### Terms you cannot win, and should stop wanting

"Sleep sounds", "white noise", "sleep app", "relax", "meditation", "calm". These are owned by apps
with eight-figure marketing budgets and millions of ratings. Ranking is heavily driven by install
velocity and rating volume, and you will have neither at launch. Include them once or twice for
relevance — you will never rank on them, but they help the algorithm classify what your app is.

### Terms you can realistically win

The strategy is to be the *best* result for a small number of specific queries rather than the
thousandth-best result for a huge one. Specific queries also convert far better, because someone
searching "brown noise" already knows what they want.

**Noise colours** — `pink noise`, `brown noise`, `brown noise for sleep`, `pink noise sleep`,
`noise colors`. This is the sweet spot. Brown noise in particular had a genuine cultural moment and
searches are large and growing, while the competition is mostly thin single-purpose apps with poor
ratings. Quietloom is a better product than nearly all of them and it can *explain why* pink is
defaulted, which is exactly what someone searching this term wants to know. **This is your primary
keyword cluster.** It is why the title carries "Pink Noise".

**Sound masking** — `sound masking`, `noise masking`, `block out noise`, `noisy neighbors`,
`traffic noise sleep`, `snoring masking`. Lower volume, but very high intent and much thinner
competition. These people have a specific problem and will read a description.

**Binaural** — `binaural beats`, `binaural beats sleep`, `delta waves`, `0.25 Hz`. A crowded space
full of nonsense apps, which is exactly the opening: Quietloom uses the frequencies that were actually
tested (250 Hz carrier, 0.25 Hz offset, per Fan 2024), badges the layer honestly as *Emerging*, and
tells you headphones are physically required. Being the credible option in a field of quackery is a
real position.

**Baby and nursery** — `baby sleep sounds`, `white noise for baby`, `nursery sound machine`, `safe
volume baby`. Highly commercial, and the nursery-safe cap is a genuine, specific, checkable feature
nobody else has. Handle it carefully: put these words in the description, but keep the declared
target audience adult in Play Console for the Families-policy reason in step 8.

**Breathing and HRV** — `breathing exercise sleep`, `coherent breathing`, `6 breaths per minute`,
`4-7-8 breathing`, `HRV breathing`, `box breathing`. Small but engaged, and it overlaps with the
biohacker audience that shares things.

**The research angle** — `science based sleep`, `evidence based sleep sounds`, `sleep research`,
`sleep sounds with sources`. Very low search volume; almost nobody types this. Its value is not
search traffic, it is *conversion and press*. It is what turns a store visitor into an installer,
what makes a Hacker News comment thread go well, and what a journalist can build a paragraph around.
Do not judge it by impressions.

**Product qualities** — `no loop sleep sounds`, `offline sleep sounds`, `sleep sounds no
subscription`, `sleep timer`, `red night light`, `bedside clock`. Long-tail and small, but each one
is a specific complaint about a competitor, and someone typing it is one sentence away from
installing.

### Two things that beat keywords

Ratings volume and store-listing conversion rate outrank almost all keyword tuning. Ask for a rating
in-app, once, after the fifth session, and never again if the user dismisses it. And use Play
Console's free **store listing experiments** to A/B test your icon and first screenshot — a 20%
conversion improvement is common and it is worth more than any keyword change you can make.

---

## 6. Launch plan with no marketing budget

You have zero dollars, so the currency is *interestingness*. Fortunately Quietloom is interesting in
three separate ways — the synthesis, the citations, and the contrarian defaults — and each one is a
different story for a different audience.

The single sentence everything hangs on: **"I built a sleep app where every sound is synthesised in
real time and every claim cites a paper."**

### Sequencing

Do not fire everything at once. Order matters, because early feedback improves the later posts and
because reviews and install velocity compound.

**Week 0** — soft launch. Get the app into production, get your twelve closed testers to leave
honest reviews, fix whatever they find. Ratings below about 4.0 will kneecap everything that
follows.

**Week 1** — Reddit, one subreddit at a time.

**Week 2** — Hacker News and Product Hunt, ideally on different days.

**Weeks 3–4** — short-form video, and press outreach if anything landed.

### Reddit — highest potential, highest ban risk

Read this before posting anywhere. **Reddit will ban you instantly for self-promotion done badly,
and a ban is usually permanent.** The rules that matter:

- Most subreddits enforce a rough 10:1 ratio — ten genuine contributions for every self-promotional
  post. A brand-new account whose first post is a link to an app gets removed within minutes.
- Never use alt accounts to upvote or comment on your own post. Reddit detects it and site-wide bans
  follow.
- Read each subreddit's rules page and its pinned posts first. Actually read them.
- Lead with the story, not the download. The post that works is "here is what I learned reading the
  sleep literature, and here is the thing I built from it". The post that gets removed is "check out
  my new app".

Where to go, in order of fit:

**r/AndroidApps** — the safest starting point. It explicitly allows developer self-promotion, often
in a dedicated weekly thread. Check the current rules; they change. Offer free premium codes.

**r/SideProject** and **r/IndieDev** — self-promotion is the entire point of these. Small audiences,
but useful early feedback and zero ban risk.

**r/insomnia** and **r/sleep** — the highest-value audiences and the strictest rules. Both are full
of people who have been burned by wellness marketing and both have low tolerance for promotion. Do
not post a launch announcement. If you post at all, post the *research*: "I read 20 papers on sound
and sleep and here is what surprised me — the timer should be on, pink beats white, and the
systematic review says the evidence is weak". Put the app link at the bottom, flagged plainly as
yours. Expect it to be removed anyway. Better still: spend two weeks genuinely answering questions
there first, and let people ask you what you built.

**r/webaudio, r/javascript, r/programming** — a completely different and much friendlier story:
"I synthesised rain, fire and ocean with no samples at all". Technical audiences love
this and there is no promotional stigma attached to showing your work. This is probably your best
Reddit shot after r/AndroidApps.

**r/GetMotivated** — included for completeness, but I would skip it. It is a wrong-fit audience
for a sleep app and the subreddit is hostile to product links.

### Hacker News — the best-shaped opportunity you have

This is the one I would put the most effort into, because Quietloom is unusually HN-shaped. HN
consistently rewards exactly three things Quietloom has: something built from first principles rather
than assembled from libraries, intellectual honesty about limitations, and a citation trail.

Post as a **Show HN**:

```
Show HN: I synthesised every sound in a sleep app and cited every study
```

Practical notes. Post Tuesday to Thursday, around 8–10am US Eastern. Keep the title factual — HN
punishes hype instantly. Write a first comment that explains the technical approach (the 1/f
amplitude envelope, why a recording loops and synthesis does not, how the fire crackle is generated)
and openly states the limitations: Deep Pulse is open-loop and cannot phase-lock without EEG, the
systematic review rates continuous-noise evidence as very low, the timer defaults on for that
reason. **Never ask for upvotes** — it is the fastest way to get flagged.

Then be present in the thread for the whole day and answer everything, including the hostile
comments. Somebody will check your citations. Somebody will argue that binaural beats are
pseudoscience — and your honest answer is that the layer is badged *Emerging*, uses the exact
parameters from a 12-person study, and the app itself says the effect is impossible without stereo
separation. That exchange, handled well in public, is worth more than the front page.

Have a web demo ready. HN is a desktop audience and most of them will not install an APK, but the
app runs in a browser, so a link where they can hear the synthesis in one click will multiply your
conversion enormously.

### Product Hunt

Worth one good shot. Launch Tuesday–Thursday at 12:01am Pacific (the daily leaderboard resets then,
so you want a full 24 hours). Prepare the gallery, a short demo video, and a first comment that
tells the story in five sentences. The tagline should be the differentiator: *"Sleep sounds
synthesised in real time — with the research behind every one."* Product Hunt's audience skews
toward makers and wellness-tech, which is a decent overlap. Realistically expect a few hundred
installs from a good day, not thousands.

### TikTok and YouTube Shorts

The visualiser is the asset here. Rain, embers and the ocean swell are genuinely nice to look at,
and this is the only channel with real upside beyond your existing networks. Formats that work:

- *"Your white noise app is using the wrong colour."* Fifteen seconds, pink versus white with the
  visualiser, ending on the Zhou result. This is a strong, argumentative, shareable hook.
- *"This isn't a recording. It's math."* Show the code, then the sound.
- *"Breathe with the waves."* One ten-second swell, on loop, as an actual usable pacer. This format
  performs well on its own as ambient content.
- *"Why your sleep app should turn itself off."* The counter-intuitive timer argument.

Post consistently rather than perfectly — three a week for a month beats one polished video. Put the
Play Store link in the profile, not in the caption.

### Press

The research angle is a real hook, which is unusual — most indie apps have nothing a journalist can
build a story around. "The only sleep app that cites its sources" is a headline someone else can
write. Pitch short, personal emails (never a press release) to Android Police, 9to5Google,
Android Authority, and the app columns at The Verge and Ars Technica. Sleep-and-science newsletters
and podcasts are a smaller but much warmer audience.

One underrated move: **tell the researchers**. A short, genuinely respectful email to the authors of
the studies you cite — "I built an app that implements your protocol and links to your paper, I
thought you might like to see it" — costs nothing. Academics share things on Bluesky and Mastodon,
their audiences are exactly your audience, and it is a coverage source no competitor can replicate
because no competitor cites anyone.

---

## 7. The 30-day roadmap, ranked by expected value

Ranked by what makes money, not by what is enjoyable to build. Retention comes first because it
multiplies every number in section 2 — doubling D7 retention roughly doubles DAU, which doubles ad
revenue *and* IAP conversion *and* your Play Store ranking. No other change does that.

### Days 1–3: finish going live (highest EV in the entire document)

Everything in section 3. Real ad IDs, `TEST_MODE = false`, `app-ads.txt`, the consent form. Until
this is done, every other item on this list has an expected value of exactly zero. There is no
second-highest-priority item; this is the only priority.

### Days 4–10: retention (the highest-leverage feature work)

**A bedtime reminder notification.** If you build one thing, build this. A local notification at a
user-chosen time ("Time to wind down") is the single most effective retention mechanic for a nightly
habit app, and because it is local it needs no server, no push infrastructure and no privacy policy
change. Ask for the time during onboarding, make it easy to turn off. Expect a double-digit
percentage improvement in D7.

**Open straight into the last mix.** `KEYS.lastMix` already exists in the store. One tap to sound,
no menu. Reduces the friction of the nightly habit to nearly nothing.

**A home-screen widget or quick-settings tile.** "Resume last mix" without opening the app, and a
persistent visual reminder on the user's home screen. This is real native work in React Native
(a config plugin plus a Kotlin widget provider), so treat it as a week, not an afternoon. Note the
lock-screen media notification already covers part of the same job for free.

**A streak, done gently.** "You have wound down 7 nights in a row." Do not gamify it aggressively —
this audience will find that obnoxious, and guilt-tripping someone about sleep is counterproductive.
A quiet count is enough.

**A rating prompt.** After the fifth session, once, never again if dismissed. Ratings drive store
ranking, which drives organic installs, which is free acquisition.

### Days 11–18: a subscription tier

Add a subscription alongside the one-time purchase: roughly **$2.99/month or $19.99/year**, with the
$4.99 lifetime option kept as-is. Subscriptions are how essentially every profitable wellness app
actually makes its money — recurring revenue on a nightly-use app has a lifetime value several times
a single $4.99 payment, and the annual plan front-loads cash.

Keep the pitch honest: no ads, all layers, plus whatever subscriber-only content you add later
(more scenes, personal mix cloud backup, a sleep journal). Offer a seven-day free trial; Play
Billing handles trials natively. Do not remove the lifetime option — some people flatly refuse
subscriptions and you should still take their money.

Be realistic: this is a meaningful multiplier at scale and roughly irrelevant below a few thousand
DAU. Which is why it comes after retention.

### Days 19–24: feed the rewarded funnel and tune the store

More premium layers is the most direct way to increase rewarded-video views, because every extra
desirable locked layer is another reason to watch. Cheap wins on the existing engine: a summer
thunderstorm, a train carriage, a coffee shop, a fan, a heartbeat, aeroplane cabin, distant city
rain. Each is a parameter set for machinery you already have.

At the same time, run **store listing experiments** in Play Console — free, built in, and a 20%
conversion improvement applies to every install you will ever get from that point onward.

### Days 25–30: measure, then decide

Look at the real numbers from section 8 and pick the next month based on them. If retention is
healthy but installs are low, the problem is distribution and you should spend the month on content
and outreach. If installs are fine but D7 is bad, the product has a hole and no amount of marketing
will fix it.

### Deliberately not in the first 30 days

**iOS.** React Native makes the port technically cheap — every dependency here is already
cross-platform and `app.json` carries the iOS config — but it is not commercially cheap: $99/year, a
review process that is far stricter than Google's, a completely separate ASO fight, and a second set
of store assets. iOS users do pay more — meaningfully more — so this is a *good* second market. It
is a terrible first one, because it doubles your surface area before you know whether the product
retains anyone. Do it once Android shows healthy D7 and non-trivial revenue.

**A server, accounts or cloud sync.** Adds hosting costs, a real privacy policy obligation, GDPR
exposure and an attack surface, in exchange for almost no revenue. The current "no server, no
account, no data" position is a genuine selling point. Keep it as long as you can.

**Analytics SDKs.** Play Console gives you retention and installs; AdMob gives you revenue,
impressions and eCPM. Between them you have everything in section 8 without shipping a single
tracking library. That keeps the privacy story clean and the Data safety form simple. If you ever do
add one, you must update `PRIVACY.md` and the Play Data safety declaration in the same release.

**More sounds beyond the cheap wins above, more scenes, a redesign.** All fun. None of it moves
revenue as much as a bedtime reminder notification.

---

## 8. What to watch

Five numbers. Check them weekly, not hourly — daily ad revenue is noisy and staring at it will make
you do something stupid.

| Metric | Where to find it | Unhealthy | Healthy for this category | What it means |
|---|---|---|---|---|
| **D1 retention** | Play Console → Statistics | under 20% | **25–35%** | Did the app work the first night? A bad D1 is usually onboarding, first-launch confusion, or the sound not starting fast enough. |
| **D7 retention** | Play Console → Statistics | under 8% | **10–15%** | Did it become a habit? This is the number that most determines your revenue. Bedtime reminders move it. |
| **Rewarded completion rate** | AdMob → Ad units | under 70% | **85%+** | Of the rewarded ads that start, how many pay out. Low means loading problems, users bailing, or fill issues. Also watch **match rate** — if requests are not being filled, that is money vanishing silently. |
| **ARPDAU** | AdMob revenue ÷ Play DAU | under $0.003 | **$0.005–$0.02** | The one number that summarises whether monetisation works at all. Compare it week to week, not day to day. |
| **Average session length** | Play Console → Statistics | under 5 min | **20 min+** | A sleep app with three-minute sessions is not being used for sleep. The 45-minute timer means healthy sessions should be long. |

Two more worth a monthly glance: **store listing conversion rate** (Play Console; 20–30% of store
visitors installing is healthy, and listing experiments improve it) and your **average rating**
(below 4.0 will suppress you in search, and one early wave of bad reviews is very hard to dig out
of).

### Two Quietloom-specific things to keep an eye on

**The grace rule.** `src/ui/sheets/PaywallSheet.tsx` deliberately grants the night pass whenever a
rewarded ad fails for any reason other than the user closing a real ad early
(`Ads.lastRewardedFailure() !== 'declined'`). This is the right call: nobody should be locked out of
falling asleep because an ad server was slow. But it is also a revenue leak if the ad SDK is failing
more often than you think.
Watch the ratio of rewarded impressions in AdMob against the app's daily actives. If impressions are
far below what nightly usage implies, ads are failing to initialise for a large slice of users and
they are all getting the pass for free. That is a bug worth chasing, not a policy to change.

**Interstitial contribution.** The one-per-day cap costs money by design. If interstitials turn out
to be a very small share of revenue, that vindicates the cap and you should leave it alone. If they
are a large share, resist the urge to raise the cap — check retention first. In a sleep app, an
extra interstitial that costs you 2% of D7 retention is a bad trade at almost any eCPM.

---

## In summary

The product is good and genuinely differentiated, the cost structure is excellent, and the category
converts. The realistic outcome is a small, honest income rather than a business — call it beer money
at a thousand installs and a few hundred dollars a month at ten thousand, with real upside only if
something lands.

The three things that decide which end of that range you get:

1. **Finish section 3.** Nothing else matters until real ad IDs are live. Start the Play developer
   account today because of the fourteen-day closed-testing clock.
2. **Build the bedtime reminder.** Retention multiplies every other number in this document.
3. **Tell the Hacker News story properly.** "I synthesised every sound and cited every study" is a
   genuinely good story, you only get to tell it once, and it is the highest-variance, highest-upside
   move available to you.
