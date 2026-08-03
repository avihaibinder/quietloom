/**
 * The evidence metadata behind every sound. This is Quietloom's differentiator:
 * tap the info dot on any layer and you get the actual study, not marketing copy.
 * Mirrors research.md — keep the two in sync.
 */

export const BADGE = {
  STRONG: 'Strong',
  MODERATE: 'Moderate',
  EMERGING: 'Emerging',
  TRADITIONAL: 'Traditional',
};

export const EVIDENCE = {
  rain: {
    title: 'Rain',
    badge: BADGE.STRONG,
    claim: 'Natural water sound speeds recovery from stress and shifts you toward "rest and digest".',
    detail:
      'In a controlled study, skin-conductance recovery after a stressor was 9–37% faster during nature sound than during traffic noise. A 53-person crossover study found nature soundscapes raised heart-rate variability and lowered heart and breathing rate.',
    sources: [
      { label: 'Alvarsson 2010, Int J Environ Res Public Health', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC2872309/' },
      { label: 'Kumpulainen 2025, Psychophysiology', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11726612/' },
    ],
  },
  thunder: {
    title: 'Distant Thunder',
    badge: BADGE.MODERATE,
    claim: 'Low, slow rumbles add masking energy exactly where traffic and voices sit.',
    detail:
      'Thunder was one of the elements in the nature soundscape that produced a measurable parasympathetic shift. Quietloom keeps it distant and infrequent — sudden events above about 45 dB can cause micro-arousals.',
    sources: [
      { label: 'Kumpulainen 2025, Psychophysiology', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11726612/' },
      { label: 'WHO Night Noise Guidelines 2009', url: 'https://www.who.int/europe/news-room/fact-sheets/item/noise' },
    ],
  },
  ocean: {
    title: 'Ocean',
    badge: BADGE.STRONG,
    claim: 'Each swell lasts exactly 10 seconds — 0.1 Hz — so the waves double as a breathing pacer.',
    detail:
      'Breathing at roughly six breaths per minute hits the resonance frequency of the baroreflex and maximises vagally mediated heart-rate variability. A 20-minute pre-bed session at 0.1 Hz reduced sleep-onset latency and night-time waking in self-reported insomniacs. Breathe in as the wave rises, out as it falls.',
    sources: [
      { label: 'Sevoz-Couche & Laborde 2022, Neurosci Biobehav Rev', url: 'https://www.sciencedirect.com/science/article/abs/pii/S0149763422000653' },
      { label: 'Self-Regulation of Breathing as Insomnia Treatment, Front Psychiatry 2018', url: 'https://www.frontiersin.org/journals/psychiatry/articles/10.3389/fpsyt.2018.00780/full' },
    ],
  },
  wind: {
    title: 'Wind',
    badge: BADGE.MODERATE,
    claim: 'Broad, slowly wandering sound that masks intermittent noise without a fixed pitch to latch onto.',
    detail:
      'Masking works by making a disturbing sound less audible against a steady background. Wind covers the mid frequencies where speech sits, and its 1/f gusting keeps it from feeling mechanical.',
    sources: [
      { label: 'Messineo 2017, Front Neurol', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5742584/' },
      { label: 'Alvarsson 2010, Int J Environ Res Public Health', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC2872309/' },
    ],
  },
  fire: {
    title: 'Campfire',
    badge: BADGE.STRONG,
    claim: 'Fire lowered blood pressure — but only when you could hear it. Silent fire did nothing.',
    detail:
      'Across 226 adults, blood pressure rose in the control and muted-fire conditions but fell in the fire-with-sound condition, and the effect grew the longer people listened. The sound is doing the work, which is why this is a first-class layer.',
    sources: [
      { label: 'Lynn 2014, Evolutionary Psychology', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10429110/' },
    ],
  },
  crickets: {
    title: 'Night Crickets',
    badge: BADGE.MODERATE,
    claim: 'Insect sound was part of the soundscape that raised HRV and slowed breathing.',
    detail:
      'Included in the nature-based soundscape that produced significantly higher RMSSD and lower respiratory rate versus a matched reference recording. Quietloom keeps the chirps sparse and high so they sit above the masking bed rather than competing with it.',
    sources: [
      { label: 'Kumpulainen 2025, Psychophysiology', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11726612/' },
    ],
  },
  pink: {
    title: 'Pink Noise',
    badge: BADGE.STRONG,
    claim: 'The noise with the best evidence — and the reason Quietloom defaults to pink, not white.',
    detail:
      'Steady pink noise reduced EEG complexity and significantly increased the percentage of stable sleep time in a 40-person study. Its 1/f spectrum is the same slope found throughout natural sound.',
    sources: [
      { label: 'Zhou 2012, J Theor Biol', url: 'https://pubmed.ncbi.nlm.nih.gov/22726808/' },
      { label: 'Papalambros 2017, Front Hum Neurosci', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5340797/' },
    ],
  },
  brown: {
    title: 'Brown Noise',
    badge: BADGE.MODERATE,
    claim: 'Deeper than pink. Strong low-frequency masking for traffic and footsteps upstairs.',
    detail:
      'Broadband sound at 46 dB cut median sleep-onset latency by 38% versus quiet ambient in a controlled model of transient insomnia. Brown puts most of its energy low, where the loudest intrusions live.',
    sources: [
      { label: 'Messineo 2017, Front Neurol', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5742584/' },
    ],
  },
  white: {
    title: 'White Noise',
    badge: BADGE.MODERATE,
    claim: 'The classic — but the pooled evidence is weaker than the popularity suggests.',
    detail:
      'A systematic review of 38 studies rated the quality of evidence that continuous noise improves sleep as very low, and some work suggests continuous noise may shorten deep sleep. We include white because masking genuinely helps many people, and we default the sleep timer on so it does not run all night.',
    sources: [
      { label: 'Riedy 2021, Sleep Medicine Reviews', url: 'https://www.sciencedirect.com/science/article/abs/pii/S1087079220301283' },
      { label: 'Messineo 2017, Front Neurol', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5742584/' },
    ],
  },
  binaural: {
    title: 'Binaural Beats',
    badge: BADGE.EMERGING,
    claim: 'Headphones required — the effect physically cannot happen on a speaker.',
    detail:
      'A 12-person study using a 250 Hz carrier with a 0.25 Hz offset shortened the time to reach both N2 and N3 sleep during naps. A pilot with 1–4 Hz delta beats significantly increased N3. Samples are small and slow-frequency entrainment has not replicated consistently, so we use the exact frequencies that were tested rather than invented ones.',
    sources: [
      { label: 'Fan 2024, Scientific Reports', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11525714/' },
      { label: '1–4 Hz delta pilot, SLEEP 2025', url: 'https://academic.oup.com/sleep/article/48/Supplement_1/A204/8135824' },
      { label: 'Sleep Foundation overview', url: 'https://www.sleepfoundation.org/noise-and-sleep/binaural-beats' },
    ],
  },
  deeppulse: {
    title: 'Deep Pulse',
    badge: BADGE.EMERGING,
    claim: 'Rhythmic pink-noise pulses modelled on a slow-wave enhancement protocol. Experimental.',
    detail:
      'In older adults, pink-noise pulses delivered in blocks of five, phase-locked to the up-state of slow oscillations, increased slow-wave and spindle activity and improved next-morning word recall. Quietloom has no EEG, so it runs the same pulse pattern open-loop at about 0.8 Hz — the rhythm without the phase-locking. It is an approximation of the protocol, not the protocol.',
    sources: [
      { label: 'Papalambros 2017, Front Hum Neurosci', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5340797/' },
      { label: 'Papalambros 2019, Ann Clin Transl Neurol', url: 'https://onlinelibrary.wiley.com/doi/full/10.1002/acn3.796' },
    ],
  },
  moonrise: {
    title: 'Moonrise',
    badge: BADGE.EMERGING,
    claim: 'A sheep crosses now and then. We never ask you to count it — counting is the folklore; imagery is the part that was actually tested.',
    detail:
      'Forty-one people with insomnia were each given one of three instructions for the night: distract yourself using imagery, distract yourself generally, or no instruction at all. The imagery group — told to picture a situation they found interesting and engaging, but also pleasant and relaxing — reported shorter sleep-onset latency than the no-instruction group, and rated their pre-sleep thoughts and worries as less distressing. General distraction showed no such advantage. Two honest limits: \'counting sheep\' was never one of the conditions, and the imagery was generated in the participant\'s own head in the dark, not watched on a screen. Moonrise is a nod to that finding, not a reproduction of it. One small study, a single night, not widely replicated.',
    sources: [
      { label: 'Harvey & Payne 2002, Behaviour Research and Therapy 40(3):267–277', url: 'https://pubmed.ncbi.nlm.nih.gov/11863237/' },
      { label: 'Cognitive and Affective Control in Insomnia, Front Psychol 2011 (independent description of the same study)', url: 'https://www.frontiersin.org/articles/10.3389/fpsyg.2011.00349/full' },
    ],
  },
};

export const BREATH_EVIDENCE = {
  coherence: {
    title: 'Coherence — 6 breaths / minute',
    badge: BADGE.STRONG,
    detail:
      'Breathing at ~0.1 Hz aligns respiration, blood pressure and heart rate at the resonance frequency of the baroreflex. Twenty minutes before bed reduced sleep-onset latency and night waking in self-reported insomniacs.',
    sources: [
      { label: 'Sevoz-Couche & Laborde 2022', url: 'https://www.sciencedirect.com/science/article/abs/pii/S0149763422000653' },
      { label: 'Front Psychiatry 2018;9:780', url: 'https://www.frontiersin.org/journals/psychiatry/articles/10.3389/fpsyt.2018.00780/full' },
    ],
  },
  478: {
    title: '4-7-8',
    badge: BADGE.EMERGING,
    detail:
      'Acutely lowers heart rate and blood pressure and raises high-frequency HRV power. Popular, but with thinner empirical support than plain 6 breaths per minute — which is why coherence is our default.',
    sources: [
      { label: 'Vierra 2022, Physiological Reports', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9277512/' },
      { label: 'Comparison study, 2025', url: 'https://osf.io/vyt5c/overview' },
    ],
  },
};

export const VOLUME_EVIDENCE = {
  title: 'How loud should this be?',
  detail:
    'The WHO recommends below 30 dB(A) of continuous sound inside a bedroom, and notes that single events above about 45 dB can cause micro-arousals. The trial that cut sleep-onset latency by 38% used 46 dB. Both can be true: sound helps you fall asleep, then quiet helps you stay asleep — which is why Quietloom defaults to fading out after 45 minutes.\n\nFor infants, guidance is stricter: keep a sound machine at or below 50 dB, at least 2 metres from the crib, never at maximum. Quietloom’s Nursery-safe cap enforces a hard ceiling for this.',
  sources: [
    { label: 'WHO Night Noise Guidelines for Europe (2009)', url: 'https://www.polisnetwork.eu/wp-content/uploads/2019/06/who-night-noise-guidelines.pdf' },
    { label: 'Messineo 2017, Front Neurol', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5742584/' },
    { label: 'Infant sound-machine guidance', url: 'https://parentdata.org/babies/white-noise-developmental-delays/' },
  ],
};
