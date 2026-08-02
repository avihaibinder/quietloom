# Quietloom — The Research Behind Every Sound

Quietloom is built on published sleep and psychophysiology research rather than vibes. This file is the
complete source list. Every claim below was fetched and read while building the app, and every sound
in the app links back to an entry here through `src/data/evidence.js`.

**How to read the evidence badges used in the app:**

| Badge | Meaning |
|---|---|
| **Strong** | Multiple studies or a systematic review, consistent direction of effect |
| **Moderate** | At least one controlled study with a clear result, replicated in spirit |
| **Emerging** | Promising controlled results, small samples, not yet replicated widely |
| **Traditional** | Widely used and well liked, but without direct controlled evidence for the specific claim |

---

## 1. Pink noise and sleep stability

**Zhou J, Liu D, Li X, Ma J, Zhang J, Fang J. Pink noise: effect on complexity synchronization of
brain activity and sleep consolidation. *Journal of Theoretical Biology.* 2012;306:68-72.**
n = 40 (nocturnal sleep) + 10 (nap). Steady pink noise reduced EEG signal complexity — brain activity
became more synchronised — and produced a significant increase in the percentage of *stable sleep time*
measured by cardiopulmonary coupling.
<https://pubmed.ncbi.nlm.nih.gov/22726808/>

**Papalambros NA, Santostasi G, Malkani RG, et al. Acoustic Enhancement of Sleep Slow Oscillations and
Concomitant Memory Improvement in Older Adults. *Frontiers in Human Neuroscience.* 2017;11:109.**
n = 13, ages 60–84. Pulses of pink noise were delivered phase-locked to the up-state of each slow
oscillation, in blocks of five pulses ON followed by a roughly equal OFF interval. Slow-wave activity
and spindle activity increased during ON intervals versus matched sham periods, and overnight
improvement in word recall was significantly greater with stimulation.
<https://www.frontiersin.org/journals/human-neuroscience/articles/10.3389/fnhum.2017.00109/full> ·
<https://pmc.ncbi.nlm.nih.gov/articles/PMC5340797/> · <https://pubmed.ncbi.nlm.nih.gov/28337134/>

**Papalambros NA, et al. Acoustic enhancement of sleep slow oscillations in mild cognitive impairment.
*Annals of Clinical and Translational Neurology.* 2019.**
Extension of the same protocol to adults with mild cognitive impairment.
<https://onlinelibrary.wiley.com/doi/full/10.1002/acn3.796>

> **How Quietloom uses this.** Pink noise is our default noise bed rather than white — most apps ship white
> by default, which the literature does not support as well. The **Deep Pulse** mode reproduces the
> Papalambros *stimulation pattern* (≈0.8 Hz pink-noise pulses, five ON then an equal OFF interval)
> open-loop. Quietloom has no EEG, so it cannot phase-lock to your actual slow oscillations. It is labelled
> **Experimental** in the app for exactly that reason.

---

## 2. Broadband noise and how fast you fall asleep

**Messineo L, Taranto-Montemurro L, Sands SA, Oliveira Marques MD, Azabarzin A, Wellman DA. Broadband
Sound Administration Improves Sleep Onset Latency in Healthy Subjects in a Model of Transient Insomnia.
*Frontiers in Neurology.* 2017;8:718.**
n = 18. Broadband filtered noise at 46.0 dB versus ambient noise at 40.1 dB produced a **median 38%
reduction in sleep onset latency** to stage 2 sleep (19 → 13 minutes, p = 0.011). Among subjects who
reported subjective improvement the reduction was 42%. The mechanism is auditory masking: a steady
low-level sound reduces the audibility of disruptive intermittent sounds.
<https://pmc.ncbi.nlm.nih.gov/articles/PMC5742584/>

### The counter-evidence — we ship this too

**Riedy SM, Smith MG, Rocha S, Basner M. Noise as a sleep aid: A systematic review. *Sleep Medicine
Reviews.* 2021;55:101385.**
38 articles reviewed. The conclusion: the overall quality of evidence that continuous noise improves
sleep is **very low**, which the authors explicitly contrast with how widespread the practice is.
<https://www.sciencedirect.com/science/article/abs/pii/S1087079220301283>

**McGill Office for Science and Society — commentary on evidence that continuous noise can shorten
deep sleep.**
<https://www.mcgill.ca/oss/article/critical-thinking-health-and-nutrition-technology/white-noise-may-worsen-sleep>

> **How Quietloom uses this.** Honesty is a feature. Noise beds are badged **Moderate**, not Strong, and the
> app links to the negative review as well as the positive trial. It is also why the **sleep timer
> defaults to ON at 45 minutes**: the evidence supports sound as a sleep-onset aid far better than it
> supports blasting noise at yourself for eight hours. Quietloom is designed to turn itself off.

---

## 3. Nature sounds, stress recovery and heart rate variability

**Alvarsson JJ, Wiens S, Nilsson ME. Stress Recovery during Exposure to Nature Sound and Environmental
Noise. *International Journal of Environmental Research and Public Health.* 2010;7(3):1036-1046.**
n = 40. After a stressor, skin conductance recovery was **9–37% faster** during nature sound (fountain
and birds, 50 dB) than during traffic noise. Half-life of recovery: 101.3 s for nature sound versus
159.8 s for high noise.
<https://pmc.ncbi.nlm.nih.gov/articles/PMC2872309/>

**Kumpulainen S, Esmaeilzadeh S, Pesonen M, Brazão C, Pesola AJ. Enhancing Psychophysiological
Well-Being Through Nature-Based Soundscapes: An Examination of Heart Rate Variability in a Cross-Over
Study. *Psychophysiology.* 2025.**
n = 53, randomised crossover, loudness-matched. Ten minutes of a nature-based soundscape (water, birds,
insects, wind, thunder, rain, campfire) versus a coffee-shop reference produced higher RMSSD
(p = 0.048), higher HF power (p = 0.01), lower heart rate (p = 0.004) and lower respiratory rate
(p < 0.001) — a clear parasympathetic shift.
<https://pmc.ncbi.nlm.nih.gov/articles/PMC11726612/>

**The effect of exposure to natural sounds on stress reduction: a systematic review and meta-analysis.
*Stress.* 2024.**
<https://www.tandfonline.com/doi/full/10.1080/10253890.2024.2402519>

> **How Quietloom uses this.** The nature layers are the core of the library, not decoration, and the
> presets deliberately combine the same element families used in the crossover study rather than
> arbitrary pairings.

---

## 4. Fire

**Lynn CD. Hearth and Campfire Influences on Arterial Blood Pressure: Defraying the Costs of the Social
Brain through Fireside Relaxation. *Evolutionary Psychology.* 2014;12(5):983-1003.**
n = 226 across three studies, randomised crossover. Blood pressure **rose** in the control and the
*muted* fire conditions but **fell** in the fire-with-sound condition. The effect grew with longer
exposure and was stronger in people scoring higher on absorption.
<https://pmc.ncbi.nlm.nih.gov/articles/PMC10429110/>

> **How Quietloom uses this.** The single most interesting detail in that study is that silent fire did not
> work — the sound is doing the work. So campfire is a first-class synthesised layer with its own ember
> scene, and the app nudges toward longer sessions because the effect was duration-dependent.

---

## 5. Binaural beats

**Fan Z, Zhu Y, Suzuki C, Suzuki Y, Watanabe Y, Watanabe T, Abe T. Binaural beats at 0.25 Hz shorten the
latency to slow-wave sleep during daytime naps. *Scientific Reports.* 2024;14:26062.**
n = 12. Carrier 250 Hz to the left ear, 250.25 Hz to the right. Both N2 and N3 latencies were shorter
than sham (effect sizes 0.773 and 0.682).
<https://pmc.ncbi.nlm.nih.gov/articles/PMC11525714/> · <https://doi.org/10.1038/s41598-024-76059-9>

**The Effects of 1-4 Hz Binaural Beats on Delta Brain Wave During Sleep in University Students: A Pilot
Study. *SLEEP.* 2025;48(Suppl 1):A204.**
Increases in total sleep time, sleep efficiency and N3; only the N3 increase reached significance
(p = 0.033).
<https://academic.oup.com/sleep/article/48/Supplement_1/A204/8135824>

**Dabiri R, Monazzam Esmaielpour MR, Salmani Nodoushan M, Khaneshenas F, Zakerian SA. The effect of
auditory stimulation using delta binaural beat for a better sleep and post-sleep mood: A pilot study.
*Digital Health.* 2022.**
<https://journals.sagepub.com/doi/full/10.1177/20552076221102243>

**Caveat, shown inside the app.** Entrainment at very slow frequencies has not replicated consistently,
sample sizes are small, and the effect is physically impossible without stereo separation — **headphones
are required**. Overview: <https://www.sleepfoundation.org/noise-and-sleep/binaural-beats>

> **How Quietloom uses this.** Our binaural presets use the exact parameters that were actually tested
> (0.25 Hz on a 250 Hz carrier; 1–4 Hz delta) instead of invented numbers, the layer is badged
> **Emerging**, and the app refuses to pretend it works on a phone speaker.

---

## 6. Slow breathing — 0.1 Hz resonance, and 4-7-8

**Sevoz-Couche C, Laborde S. Heart rate variability and slow-paced breathing: when coherence meets
resonance. *Neuroscience & Biobehavioral Reviews.* 2022.**
Breathing at roughly 0.1 Hz — six breaths per minute — puts respiration, blood pressure and heart rate
into phase at the resonance frequency of the baroreflex, maximising vagally mediated HRV.
<https://www.sciencedirect.com/science/article/abs/pii/S0149763422000653>

**Self-Regulation of Breathing as an Adjunctive Treatment of Insomnia. *Frontiers in Psychiatry.*
2018;9:780.**
A 20-minute pre-bed session at 0.1 Hz reduced sleep onset latency and wake-after-sleep-onset, reduced
the percentage of N2, and improved subjective sleep quality in self-reported insomniacs.
<https://www.frontiersin.org/journals/psychiatry/articles/10.3389/fpsyt.2018.00780/full>

**Vierra J, Boonla O, Prasertsri P. Effects of sleep deprivation and 4-7-8 breathing control on heart
rate variability, blood pressure, blood glucose, and endothelial function in healthy young adults.
*Physiological Reports.* 2022.**
4-7-8 breathing acutely lowered heart rate and blood pressure; LF and VLF power fell while HF power
rose — a parasympathetic shift.
<https://pmc.ncbi.nlm.nih.gov/articles/PMC9277512/>

**Comparing the effects of square, 4-7-8, and 6 breaths-per-minute breathing on heart rate variability,
CO₂ levels, and mood. 2025.**
Notes that the popular box and 4-7-8 patterns have thinner empirical support than plain 6 breaths per
minute.
<https://osf.io/vyt5c/overview>

**The Effects of Presleep Slow Breathing and Music Listening on Polysomnographic Sleep Measures.
*Scientific Reports.* 2020.**
<https://www.nature.com/articles/s41598-020-64218-7>

> **How Quietloom uses this.** The breathing pacer defaults to **6 breaths per minute** (badged Strong),
> with 4-7-8 offered as a secondary option (badged Emerging) rather than the other way round. And the
> ocean layer's swell period is locked to **10 seconds — exactly 0.1 Hz** — so the waves themselves are
> a breathing pacer you can follow without opening a separate screen.

---

## 7. Why synthesised sound can beat a recording: 1/f fluctuation

**Dynamic Synchronization and Resonance as a Universal Origin of 1/f Fluctuations — Amplitude Modulation
Across Music and Nature. arXiv:2508.10049.**
The 1/f spectral law that characterises natural, comfortable sound lives in the *demodulated amplitude
envelope*, not in the raw waveform. It arises from stochastic synchronisation among many oscillators
plus frequency-selective resonance.
<https://arxiv.org/html/2508.10049>

Background on 1/f fluctuation and perceived comfort in natural sound:
<https://amix-design.com/tl/en/tool-chill/column/science-of-1f-fluctuation.html>

> **How Quietloom uses this.** Every layer in the engine is multiplied by a slow **1/f amplitude envelope**.
> This is the difference between "a noise generator" and "rain." It is also why Quietloom ships zero audio
> files: a recording loops, and once you notice the loop point you cannot un-notice it. Synthesis with
> a 1/f envelope never repeats.

---

## 8. Safe volume — the feature almost nobody ships

**World Health Organization. Night Noise Guidelines for Europe. 2009.**
Recommends below **30 dB L­Aeq** for continuous noise inside bedrooms, and **45 dB LAmax** for individual
noise events. Levels between 30 and 40 dB can cause body movements and arousals without full waking;
above 40 dB, sleep architecture is measurably disrupted.
<https://www.polisnetwork.eu/wp-content/uploads/2019/06/who-night-noise-guidelines.pdf> ·
<https://www.who.int/europe/news-room/fact-sheets/item/noise>

**American Academy of Pediatrics guidance, as widely reported.**
Sound machines in hospital nurseries kept at **50 dB or lower**; machines placed at least **7 feet (2 m)**
from an infant's sleep space and never at maximum volume.
<https://getsnooz.com/blogs/snoozweek/safe-decibel-levels-for-infants> ·
<https://parentdata.org/babies/white-noise-developmental-delays/>

> **How Quietloom uses this.** There is a volume guide built into the app, a warning when the master volume
> goes high, and a **Nursery-safe cap** that hard-limits output for anyone using this near a baby. Note
> the tension we are honest about: Messineo's positive result used 46 dB, which is *above* the WHO
> continuous-noise recommendation. That is precisely why the timer defaults on — mask the noisy part of
> the evening, then get quiet.

---

## 9. Why bedside mode is red

**Harvard Health. Blue light has a dark side.**
Light of any kind suppresses melatonin; blue does so far more powerfully.
<https://www.health.harvard.edu/healthy-aging-and-longevity/blue-light-has-a-dark-side>

**Comparative Effects of Red and Blue LED Light on Melatonin Levels During Three-Hour Exposure in
Healthy Adults. 2025.**
After two hours, blue light held melatonin suppressed at 7.5 pg/mL while red light allowed recovery to
26.0 pg/mL.
<https://pmc.ncbi.nlm.nih.gov/articles/PMC12113466/>

> **How Quietloom uses this.** Bedside mode is deep red and amber on near-black, not white-on-black like
> every other clock app. If the app is going to be the last thing you look at, it should be the least
> disruptive thing you look at.

---

## Disclaimer

Quietloom is a relaxation and sound-masking tool. It is **not a medical device**. Sample sizes across this
literature are small, effects vary a great deal between individuals, and the pooled evidence for
continuous noise as a sleep aid is rated low quality by the most rigorous review available. Nothing in
this app diagnoses, treats, or cures insomnia or any other condition. If you have a persistent sleep
problem, talk to a doctor.
