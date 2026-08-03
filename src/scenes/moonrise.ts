/**
 * Moonrise — a phase-correct moon over a dark meadow, and a sheep that ambles
 * across the crest every minute or two.
 *
 * Three things carry the scene and each of them is cached, not computed:
 *   - the moon is a sprite, redrawn only when the size (or the date) changes.
 *     Its phase is a synodic approximation off a known new moon, so the moon in
 *     the app is the moon outside the window to within a day.
 *   - the meadow is one offscreen sprite covering the bottom band of the screen;
 *     the crest function it was drawn from is the same one the sheep walks on.
 *   - the halo is a single fixed-size radial sprite drawn scaled (the tintSprite
 *     pattern from stars.ts), so repeated resizes never grow the cache.
 *
 * Everything moves off the `dt` / `env.time` the renderer hands in. This module
 * never schedules a frame and never sets a timer: an all-night app cannot
 * afford a second clock, and the renderer already stops the only one there is
 * when the app is backgrounded, bedside is on, or audio is stopped.
 *
 * The sheep is a delighter and delighters die from repetition — see the rules of
 * restraint in design/moonrise-scene-spec.md §2. One at a time, 60–120s apart,
 * ~10s on screen, exactly one hop, no sound, no counter. None in bedside mode
 * and none in the still frame.
 *
 * Sprites that are blitted 1:1 (the moon, the meadow) are built at env.dpr and
 * drawn back down to logical size — an offscreen Skia surface is a fixed pixel
 * buffer, unlike the live canvas which Skia renders at native resolution.
 */

import { createSprite, Gradient2D, type OffscreenSprite, type Ctx2D } from './canvas';
import type { SceneEnv, SceneModule } from './types';

/* ------------------------------------------------------------- tunables --- */

const SHEEP_GAP_MIN = 60; // seconds between one sheep leaving and the next arriving
const SHEEP_GAP_MAX = 120;
const SHEEP_CROSS_MIN = 9; // seconds to cross the screen
const SHEEP_CROSS_MAX = 11;

/**
 * Welcome-screen mode. That screen is a poster, not a window, so it obeys
 * neither clock the live scene does.
 *
 * The moon is placed as if it were 22:00 — a real hour on the same night arc,
 * which lands the disc a little left of centre and about a quarter of the way
 * down the sky, instead of resting behind the hill where the real one belongs
 * at breakfast. Only the POSITION is staged: the phase still comes off the
 * synodic clock, because the phase is the part that claims to be true.
 *
 * The first sheep is brought forward for the same reason. At the live 60–120s
 * cadence a sheep would essentially never appear in the few seconds this screen
 * is up, and a sheep nobody sees is not a delighter. The rules of restraint in
 * design/moonrise-scene-spec.md §2 govern the scene you sleep to; this is the
 * cover of the book.
 */
const WELCOME_HOUR = 22;
const WELCOME_SHEEP_MIN = 4; // seconds before the welcome screen's first sheep
const WELCOME_SHEEP_MAX = 8;

const SYNODIC = 29.53058867; // days
const NEW_MOON_EPOCH = Date.UTC(2000, 0, 6, 18, 14); // a known new moon

const TAU = Math.PI * 2;

const DISC = '#dfe4ee'; // under the #e8edf5 ceiling, and the brightest thing here
const FLEECE = '#c9d1df';
const DARK = '#39404f';

/* --------------------------------------------------------------- caches --- */

interface Star {
  x: number;
  y: number;
  r: number;
  a: number;
  vx: number;
  tw: number;
  twSpeed: number;
}

interface Cloud {
  img: OffscreenSprite;
  w: number;
  h: number;
  y: number;
  v: number;
  x: number;
}

let sky: Gradient2D | null = null;
let field: Star[] = [];
let clouds: Cloud[] = [];
let meadow: OffscreenSprite | null = null; // the band the crest moves through
let meadowTop = 0;
let meadowBottom = 0;
let moonSprite: OffscreenSprite | null = null;
let moonSpriteSize = 0; // logical (dp) size of the moon sprite
let halo: OffscreenSprite | null = null; // fixed-size, resolution independent
let phase = 0; // 0..1 of the synodic month
let phaseDay = -1; // the day the sprite was drawn for
let moonR = 33;
let unit = 1; // "one phone" scale for the moon and the sheep
let stoneX = 0;
let view = { w: 0, h: 0 };
let moonPos = { x: 0, y: 0 };
let moonAt = -1; // env.time the position above was computed at

let welcome = false; // this scene is being shown as the welcome screen
let welcomeSheepPending = false; // bring the next sheep forward, once

/**
 * Stage the scene for the welcome screen, or put it back. Idempotent, and the
 * live scene is left exactly as it was the moment this goes false.
 */
export function setWelcomeMode(on: boolean): void {
  if (welcome === on) return;
  welcome = on;
  moonAt = -1; // the moon is about to move; the 10s cache is stale
  welcomeSheepPending = on;
}

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

/* ----------------------------------------------------------------- moon --- */

/** Fraction of the synodic month, 0 = new, 0.5 = full. ±1 day is plenty. */
function lunarPhase(nowMs: number): number {
  const days = (nowMs - NEW_MOON_EPOCH) / 86_400_000;
  return (((days % SYNODIC) / SYNODIC) + 1) % 1;
}

/**
 * Where the moon sits, from the wall clock. The night 18:00 → 06:00 sweeps the
 * shallow arc left to right. Through the day it has not risen: it rests down on
 * the crest, mostly behind the front hill, and pulls up to the arc's start over
 * the hour either side of dusk and dawn so the position never jumps. Motion is
 * ~25px an hour — you notice it between nights, not during one.
 */
function moonPlace(w: number, h: number, nowMs: number): { x: number; y: number } {
  const d = new Date(nowMs);
  const hours = welcome ? WELCOME_HOUR : d.getHours() + d.getMinutes() / 60;
  const u = (((hours - 18) / 24) + 1) % 1; // 0 at 18:00, 0.5 at 06:00
  const night = u < 0.5;
  const p = night ? u * 2 : (u - 0.5) * 2;
  const x = w * (night ? 0.14 + 0.72 * p : 0.86 - 0.72 * p);
  const edge = h * 0.46; // where the night arc starts and ends

  if (night) return { x, y: edge - (edge - h * 0.2) * Math.sin(Math.PI * p) };

  // ×4 so it is down on the crest within an hour of sunrise and stays there
  // until an hour before dusk, but the value still meets the arc at 06:00/18:00.
  const settle = Math.min(1, Math.sin(Math.PI * p) * 4);
  // Against the skyline, not the front crest: over much of the width the back
  // hill stands higher, and resting on the front one would bury the moon whole.
  const resting = skylineY(x, h) + moonR * 0.5;
  return { x, y: edge + (resting - edge) * settle };
}

/** True once the hill has taken the moon: the UI must not offer a tap on it. */
function belowCrest(x: number, y: number, h: number): boolean {
  return y >= skylineY(x, h) - moonR * 0.25;
}

/**
 * The moon drifts ~25px an hour, so its place is worth recomputing every ten
 * seconds of scene time and not on every one of the 24 frames in each of them.
 */
function moonNow(env: SceneEnv): { x: number; y: number } {
  if (moonAt >= 0 && env.time - moonAt < 10) return moonPos;
  moonAt = env.time;
  moonPos = moonPlace(env.w, env.h, Date.now());
  return moonPos;
}

export interface MoonTarget {
  x: number;
  y: number;
  r: number;
  occluded: boolean;
  veil: number;
}

/**
 * Everything the UI needs to know about the moon on screen, in dp: where it is,
 * how big, whether the hill has swallowed it, and how much cloud is currently
 * sitting on it. The crest and the cloud maths live here so no other layer has
 * to keep a copy of them.
 */
export function moonTarget(): MoonTarget | null {
  if (!view.w || !view.h) return null;
  const p = moonPlace(view.w, view.h, Date.now());
  return {
    x: p.x,
    y: p.y,
    r: moonR,
    occluded: belowCrest(p.x, p.y, view.h),
    veil: cloudVeil(p.x, p.y),
  };
}

/**
 * Phase-correct disc: the lit-side semicircle closed by an elliptical
 * terminator, mirrored for a waning moon. A dim earthshine disc underneath
 * keeps the unlit limb from disappearing into the sky.
 */
function buildMoon(nowMs: number, dpr: number): void {
  const now = new Date(nowMs);
  phase = lunarPhase(nowMs);
  phaseDay = now.getDate();

  const pad = Math.ceil(moonR * 0.12) + 2;
  const S = Math.ceil((moonR + pad) * 2);
  const sprite = createSprite(S * dpr, S * dpr);
  const g = sprite.ctx;
  g.scale(dpr, dpr);
  const cx = S / 2;
  const cy = S / 2;

  g.beginPath();
  g.arc(cx, cy, moonR, 0, TAU);
  g.fillStyle = 'rgba(223,228,238,0.09)';
  g.fill();

  const cosP = Math.cos(TAU * phase);
  const rx = Math.max(0.5, Math.abs(cosP) * moonR);

  // The lit region goes onto its own sprite first so the terminator can be
  // softened afterwards without dragging the outer limb out with it.
  const lit = createSprite(S * dpr, S * dpr);
  const lg = lit.ctx;
  lg.scale(dpr, dpr);
  lg.translate(cx, cy);
  if (phase > 0.5) lg.scale(-1, 1); // waxing lights the right; mirror for waning
  lg.beginPath();
  lg.arc(0, 0, moonR, -Math.PI / 2, Math.PI / 2, false);
  if (cosP >= 0) {
    lg.ellipse(0, 0, rx, moonR, 0, Math.PI / 2, -Math.PI / 2, true); // crescent
  } else {
    lg.ellipse(0, 0, rx, moonR, 0, Math.PI / 2, (3 * Math.PI) / 2, false); // gibbous
  }
  lg.closePath();
  const fill = lg.createRadialGradient(0, 0, moonR * 0.2, 0, 0, moonR);
  fill.addColorStop(0, DISC);
  fill.addColorStop(1, '#c9d3e6');
  lg.fillStyle = fill;
  lg.fill();

  // A real terminator is a fuzzy band, not a drawn edge. Blur the lit shape and
  // clip the result back to the disc: the seam softens, the limb stays put.
  // Once per resize or date change — never per frame.
  g.save();
  g.beginPath();
  g.arc(cx, cy, moonR, 0, TAU);
  g.clip();
  g.filter = `blur(${Math.max(1, moonR * 0.07).toFixed(2)}px)`;
  g.drawImage(lit, 0, 0, S, S);
  g.filter = 'none';
  g.restore();

  moonSprite = sprite;
  moonSpriteSize = S;
}

/** One 256px halo, drawn scaled. Built once — resizes never add a second one. */
function ensureHalo(): OffscreenSprite {
  if (halo) return halo;
  const S = 256;
  const sprite = createSprite(S, S);
  const g = sprite.ctx;
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, 'rgba(200,214,240,1)');
  grad.addColorStop(0.18, 'rgba(200,214,240,0.55)');
  grad.addColorStop(0.45, 'rgba(200,214,240,0.16)');
  grad.addColorStop(1, 'rgba(200,214,240,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  halo = sprite;
  return sprite;
}

/* ----------------------------------------------------------- sky + field --- */

function resetGradients(): void {
  sky = null;
}

function ensureSky(ctx: Ctx2D, env: SceneEnv): Gradient2D {
  if (sky) return sky;
  const g = ctx.createLinearGradient(0, 0, 0, env.h);
  g.addColorStop(0, '#0a1020');
  g.addColorStop(0.55, '#060a14');
  g.addColorStop(1, '#03040a');
  sky = g;
  return g;
}

/** The stars.ts field at half density and two thirds of the alpha. */
function buildField(env: SceneEnv): void {
  const scale = Math.max(0.45, Math.min(2.2, env.area));
  const count = Math.round(75 * scale);
  field = [];
  for (let i = 0; i < count; i += 1) {
    const depth = Math.random();
    field.push({
      x: Math.random() * env.w,
      y: Math.random() * env.h * 0.74, // the meadow owns the bottom of the frame
      r: 0.4 + depth * 1.1,
      a: (0.16 + depth * 0.6) * 0.67,
      vx: (0.9 + depth * 2.4) * 0.09,
      tw: Math.random() * Math.PI * 2,
      twSpeed: rand(0.2, 0.7),
    });
  }
}

function drawField(ctx: Ctx2D, env: SceneEnv, dt: number, twinkle: boolean): void {
  ctx.fillStyle = '#dfe7f5';
  const energy = 0.55 + 0.45 * env.intensity;
  for (const s of field) {
    if (dt) {
      s.x += s.vx * dt;
      s.tw += s.twSpeed * dt;
      if (s.x > env.w + 2) s.x = -2;
    }
    ctx.globalAlpha = (twinkle ? s.a * (0.62 + 0.38 * Math.sin(s.tw)) : s.a * 0.85) * energy;
    ctx.fillRect(s.x, s.y, s.r * 2, s.r * 2);
  }
  ctx.globalAlpha = 1;
}

/* --------------------------------------------------------------- clouds --- */

/** A long, flat band: overlapping wide blobs strung along the middle. */
function cloudSprite(w: number, h: number): OffscreenSprite {
  const sprite = createSprite(w, h);
  const g = sprite.ctx;
  const cw = sprite.width;
  const ch = sprite.height;

  // Densely overlapped and individually faint, then blurred into one another:
  // left as discrete blobs the band reads as a row of eggs. Build time only.
  const lumps = createSprite(cw, ch);
  const lg = lumps.ctx;
  const blobs = Math.max(8, Math.round(cw / (ch * 0.85)));
  for (let i = 0; i < blobs; i += 1) {
    const bx = cw * ((i + 0.5) / blobs + rand(-0.4, 0.4) / blobs);
    const by = ch * (0.42 + 0.16 * Math.random());
    const r = ch * rand(0.36, 0.5);
    const grad = lg.createRadialGradient(bx, by, 0, bx, by, r * 2.2);
    grad.addColorStop(0, 'rgba(150,165,200,0.075)');
    grad.addColorStop(1, 'rgba(150,165,200,0)');
    lg.fillStyle = grad;
    lg.save();
    lg.translate(bx, by);
    lg.scale(2.6, 1);
    lg.translate(-bx, -by);
    lg.beginPath();
    lg.arc(bx, by, r, 0, TAU);
    lg.fill();
    lg.restore();
  }
  g.filter = `blur(${(ch * 0.22).toFixed(1)}px)`;
  g.drawImage(lumps, 0, 0);
  g.filter = 'none';

  // Fade the two ends and the top and bottom edges — two linear masks, never a
  // radial one. A centred elliptical falloff reads as lens flare over the moon.
  g.globalCompositeOperation = 'destination-in';
  const ends = g.createLinearGradient(0, 0, cw, 0);
  ends.addColorStop(0, 'rgba(0,0,0,0)');
  ends.addColorStop(0.14, 'rgba(0,0,0,1)');
  ends.addColorStop(0.86, 'rgba(0,0,0,1)');
  ends.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = ends;
  g.fillRect(0, 0, cw, ch);
  const edges = g.createLinearGradient(0, 0, 0, ch);
  edges.addColorStop(0, 'rgba(0,0,0,0)');
  edges.addColorStop(0.32, 'rgba(0,0,0,1)');
  edges.addColorStop(0.68, 'rgba(0,0,0,1)');
  edges.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = edges;
  g.fillRect(0, 0, cw, ch);
  g.globalCompositeOperation = 'source-over';

  return sprite;
}

const CLOUD_FADE = 0.14; // matches the end stops of the mask above

/**
 * Three bands, stratified rather than random: separated altitudes, separated
 * speeds, alternating directions, and start positions spread across the wrap
 * cycle so they can never set off stacked on top of each other.
 */
function buildClouds(env: SceneEnv): void {
  clouds = [];
  const n = 3;
  const scale = Math.min(1.5, Math.max(0.85, unit));
  for (let i = 0; i < n; i += 1) {
    const h = Math.round((38 + 12 * i) * scale);
    // at least the full canvas width, and never squatter than 8:1
    const img = cloudSprite(Math.max(env.w * 1.15, h * 8.5), h);
    clouds.push({
      img,
      w: img.width,
      h: img.height,
      // Stratified across the band of sky the moon's arc runs through, closely
      // enough spaced that a band is always somewhere near it: a stratum that
      // never reaches the moon can never cross it either.
      y: env.h * (0.18 + 0.11 * i),
      v: (2.4 + 1.6 * i) * (i % 2 ? -1 : 1),
      x: -img.width / 2 + ((i + 0.5) / n) * (env.w + img.width),
    });
  }
}

/**
 * 0..1 — how much cloud is actually sitting on the moon.
 *
 * A band is wider than the canvas, so distance from its centre would read as
 * permanent cover. What matters instead is how far in from its faded ends the
 * moon is, and whether the band's stratum is at the moon's altitude at all.
 */
function cloudVeil(mx: number, my: number): number {
  let veil = 0;
  for (const c of clouds) {
    const dy = 1 - Math.abs(c.y - my) / (c.h * 0.5 + moonR);
    if (dy <= 0) continue;
    const inset = Math.min(mx - (c.x - c.w / 2), c.x + c.w / 2 - mx);
    if (inset <= 0) continue;
    const dx = Math.min(1, inset / (c.w * CLOUD_FADE));
    veil = Math.max(veil, dx * dy);
  }
  return veil;
}

/* --------------------------------------------------------------- meadow --- */

/** The crest of the front hill, in screen space. The sheep walks this line. */
function crestY(x: number, h: number): number {
  return h * 0.8 - h * 0.045 * Math.sin(x * 0.0038 + 1.2) - h * 0.02 * Math.sin(x * 0.011 + 4.0);
}

/** The back hill, which over much of the width stands higher than the front. */
function backCrestY(x: number, h: number): number {
  return crestY(x, h) - h * 0.05 + h * 0.03 * Math.sin(x * 0.006 + 9);
}

/** Whichever hill the sky actually ends at, at this x. */
function skylineY(x: number, h: number): number {
  return Math.min(crestY(x, h), backCrestY(x, h));
}

function buildMeadow(env: SceneEnv): void {
  // Only the band the hills actually undulate through is a sprite. Below the
  // lowest the crest ever falls it is one flat colour, and a fillRect is
  // cheaper than blitting a quarter of the screen of identical pixels.
  meadowTop = Math.round(env.h * 0.62);
  meadowBottom = Math.round(env.h * 0.88);
  const bandH = Math.max(1, meadowBottom - meadowTop);
  const dpr = Math.max(1, env.dpr || 1);

  const sprite = createSprite(env.w * dpr, bandH * dpr);
  const g = sprite.ctx;
  // The band is drawn in screen coordinates and shifted up into the sprite.
  // setTransform's offset is in device pixels, so it carries the dpr too.
  g.setTransform(dpr, 0, 0, dpr, 0, -meadowTop * dpr);

  const step = env.w > 720 ? 8 : 6;

  // back hill
  g.beginPath();
  g.moveTo(0, env.h);
  for (let x = 0; x <= env.w; x += step) {
    g.lineTo(x, backCrestY(x, env.h));
  }
  g.lineTo(env.w, env.h);
  g.closePath();
  g.fillStyle = '#060910';
  g.fill();

  // front hill — the sheep's path
  g.beginPath();
  g.moveTo(0, env.h);
  for (let x = 0; x <= env.w; x += step) g.lineTo(x, crestY(x, env.h));
  g.lineTo(env.w, env.h);
  g.closePath();
  g.fillStyle = '#04060a';
  g.fill();

  // a handful of grass blades on the crest, nothing more
  g.strokeStyle = 'rgba(110,123,144,0.28)';
  g.lineWidth = 1;
  const blades = Math.round(26 * Math.min(2, Math.max(0.6, env.w / 390)));
  for (let i = 0; i < blades; i += 1) {
    const x = Math.random() * env.w;
    const y = crestY(x, env.h);
    const lean = rand(-2.5, 2.5) * unit;
    g.beginPath();
    g.moveTo(x, y + 1);
    g.quadraticCurveTo(x + lean * 0.4, y - 3 * unit, x + lean, y - rand(4, 8) * unit);
    g.stroke();
  }

  // the low stone the sheep hops
  stoneX = env.w * 0.56;
  const sy = crestY(stoneX, env.h);
  g.beginPath();
  g.ellipse(stoneX, sy - 3 * unit, 9 * unit, 6 * unit, 0, Math.PI, 0);
  g.closePath();
  g.fillStyle = '#0b0f18';
  g.fill();
  g.strokeStyle = 'rgba(169,185,221,0.14)';
  g.stroke();

  meadow = sprite;
}

/* ---------------------------------------------------------------- sheep --- */

const sheep = { active: false, x: 0, dir: 1, t: 0, speed: 0, nextAt: 0 };

function armSheep(time: number): void {
  sheep.active = false;
  sheep.nextAt = time + rand(SHEEP_GAP_MIN, SHEEP_GAP_MAX);
}

function launchSheep(env: SceneEnv): void {
  sheep.active = true;
  sheep.t = 0;
  sheep.dir = Math.random() < 0.5 ? 1 : -1;
  const margin = 40 * unit;
  sheep.x = sheep.dir === 1 ? -margin : env.w + margin;
  sheep.speed = (env.w + margin * 2) / rand(SHEEP_CROSS_MIN, SHEEP_CROSS_MAX);
}

/** @returns whether there is a sheep to draw this frame. */
function stepSheep(env: SceneEnv, dt: number): boolean {
  // Bedside: no new sheep, and one already crossing is dropped, not left
  // standing on the crest until the mode ends.
  if (env.night) {
    armSheep(env.time);
    return false;
  }

  // Needs env.time, which setWelcomeMode() does not have, so the arming is
  // deferred to the first frame after it.
  if (welcomeSheepPending) {
    welcomeSheepPending = false;
    sheep.active = false;
    sheep.nextAt = env.time + rand(WELCOME_SHEEP_MIN, WELCOME_SHEEP_MAX);
  }

  if (!sheep.active) {
    if (env.time < sheep.nextAt) return false;
    launchSheep(env);
  }

  sheep.t += dt;
  sheep.x += sheep.dir * sheep.speed * dt;

  const margin = 40 * unit;
  if (sheep.x > env.w + margin || sheep.x < -margin) {
    armSheep(env.time);
    return false;
  }
  return true;
}

function drawSheep(ctx: Ctx2D, env: SceneEnv): void {
  const x = sheep.x;
  let y = crestY(Math.max(0, Math.min(env.w, x)), env.h) - 7 * unit;

  // one unhurried arc-hop over the stone, and only there
  const half = 26 * unit;
  const d = x - stoneX;
  const hopping = Math.abs(d) < half;
  if (hopping) y -= 19 * unit * Math.sin(Math.PI * ((d / half + 1) / 2));

  const gait = hopping ? 0 : Math.sin(sheep.t * 9);
  const bob = hopping ? 0 : Math.abs(gait) * 1.3 * unit;

  ctx.save();
  ctx.translate(x, y - bob);
  ctx.scale(sheep.dir * unit, unit);

  // legs
  ctx.strokeStyle = DARK;
  ctx.lineWidth = 1.7;
  ctx.lineCap = 'round';
  const tuck = hopping ? 2.5 : 0;
  const legs: Array<[number, number]> = [
    [-6, 0],
    [-2, Math.PI],
    [3, Math.PI],
    [7, 0],
  ];
  for (const [lx, ph] of legs) {
    const swing = hopping ? 0 : Math.sin(sheep.t * 9 + ph) * 2.2;
    ctx.beginPath();
    ctx.moveTo(lx, 4);
    ctx.lineTo(lx + swing, 11 - tuck);
    ctx.stroke();
  }

  // fleece — a small cloud, never bright enough to light the room
  ctx.globalAlpha = 0.82;
  ctx.fillStyle = FLEECE;
  ctx.beginPath();
  ctx.ellipse(0, 0, 11.5, 7, 0, 0, TAU);
  ctx.fill();
  const puffs: Array<[number, number, number]> = [
    [-8, -3, 4.5],
    [-2, -5.5, 5],
    [4, -4.5, 4.5],
    [9, -1, 4],
  ];
  for (const [bx, by, br] of puffs) {
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, TAU);
    ctx.fill();
  }

  // tail
  ctx.beginPath();
  ctx.arc(-12, -2, 2.6, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;

  // head and ear
  ctx.fillStyle = DARK;
  ctx.beginPath();
  ctx.arc(13, -4, 3.8, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = DARK;
  ctx.beginPath();
  ctx.moveTo(14.5, -6.5);
  ctx.lineTo(17, -8.5);
  ctx.lineWidth = 1.6;
  ctx.stroke();

  ctx.restore();
}

/* -------------------------------------------------------------- assembly --- */

function build(env: SceneEnv): void {
  view = { w: env.w, h: env.h };
  unit = Math.max(0.85, Math.min(1.7, Math.min(env.w, env.h) / 390));
  moonR = Math.round(Math.max(24, Math.min(48, 33 * unit)));
  moonAt = -1; // the cached position belongs to the old size

  buildField(env);
  buildClouds(env);
  buildMeadow(env);
  buildMoon(Date.now(), env.dpr);
  ensureHalo();
  armSheep(env.time);
}

function paint(ctx: Ctx2D, env: SceneEnv, dt: number, animate: boolean): void {
  ctx.fillStyle = ensureSky(ctx, env);
  ctx.fillRect(0, 0, env.w, env.h);

  drawField(ctx, env, animate ? dt : 0, animate);

  const m = moonNow(env);
  // A long session crosses midnight; by then the phase sprite is a day stale.
  if (moonAt === env.time && new Date().getDate() !== phaseDay) buildMoon(Date.now(), env.dpr);

  const hR = moonR * 3.4;
  ctx.globalAlpha = 0.12 * (0.7 + 0.3 * env.intensity) * (1 - 0.6 * cloudVeil(m.x, m.y));
  ctx.drawImage(ensureHalo(), m.x - hR, m.y - hR, hR * 2, hR * 2);
  ctx.globalAlpha = 1;
  if (moonSprite) {
    const half = moonSpriteSize / 2;
    ctx.drawImage(
      moonSprite,
      Math.round(m.x - half),
      Math.round(m.y - half),
      moonSpriteSize,
      moonSpriteSize,
    );
  }

  for (const c of clouds) {
    if (animate && dt) {
      c.x += c.v * dt;
      if (c.v > 0 && c.x > env.w + c.w / 2) c.x = -c.w / 2;
      if (c.v < 0 && c.x < -c.w / 2) c.x = env.w + c.w / 2;
    }
    ctx.drawImage(c.img, Math.round(c.x - c.w / 2), Math.round(c.y - c.h / 2));
  }

  if (meadow) {
    ctx.drawImage(meadow, 0, meadowTop, env.w, meadowBottom - meadowTop);
    ctx.fillStyle = '#04060a';
    ctx.fillRect(0, meadowBottom, env.w, env.h - meadowBottom);
  }
}

export const moonrise: SceneModule = {
  id: 'moonrise',

  init(env) {
    resetGradients();
    build(env);
  },

  resize(env) {
    resetGradients();
    build(env);
  },

  draw(ctx, env, dt) {
    paint(ctx, env, dt, true);
    if (stepSheep(env, dt)) drawSheep(ctx, env);
  },

  drawStill(ctx, env) {
    // Sky, stars, moon, clouds, meadow — and never a sheep. Reduced motion is
    // the one setting that has to mean completely still.
    armSheep(env.time);
    paint(ctx, env, 0, false);
  },
};
