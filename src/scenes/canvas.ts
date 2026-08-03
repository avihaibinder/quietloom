/**
 * A Canvas2D-shaped adapter over Skia. The five scene modules were written
 * against CanvasRenderingContext2D and are ported nearly verbatim; this file
 * is the dictionary between the two worlds, implementing exactly the subset
 * of the 2D API the scenes use and nothing more.
 *
 * Design notes:
 *   - Colors are CSS strings ('#0b1524', 'rgba(178,206,240,0.26)') parsed by
 *     Skia.Color — the native side runs a real CSS color parser (verified in
 *     cpp/api/JsiSkColor.h → third_party/CSSColorParser). Parsed colors are
 *     cached; the cache is cleared when it grows past a cap because the waves
 *     scene generates alpha-interpolated color strings every frame.
 *   - Gradients are plain descriptors (kind + coords + stops), not ctx-bound
 *     resources, so the scenes' web-era habit of caching them across frames
 *     Just Works. The SkShader is built lazily and memoized per descriptor.
 *   - Paths are recorded in user space and drawn under the canvas CTM. Real
 *     Canvas2D bakes the CTM into path points at verb time instead; the two
 *     disagree only when the transform changes mid-path, which no scene does.
 *   - One SkPaint is reused for every draw call (SkCanvas copies the paint
 *     into the recording) — an all-night app cannot afford a paint allocation
 *     per star per frame. It is NOT reset per op: a JS mirror of every field
 *     this file ever writes is kept alongside it and only the fields that
 *     actually changed are pushed across. reset() + reconfigure cost about
 *     five native calls per draw, and the starfield alone makes 150 of them a
 *     frame. The mirror is only sound because the paint is private to this
 *     class and these are the only writers; a missed field would be a silent
 *     visual bug, so anything not provably clean is written anyway.
 *   - filter supports exactly 'blur(Npx)' and 'none'. CSS blur's length is the
 *     Gaussian standard deviation, so sigma = N, applied as an ImageFilter
 *     (Decal tiling — outside the source is transparent, as on the web).
 */

import {
  BlendMode,
  ClipOp,
  FilterMode,
  MipmapMode,
  PaintStyle,
  Skia,
  StrokeCap,
  TileMode,
} from '@shopify/react-native-skia';
import type {
  SkCanvas,
  SkColor,
  SkImage,
  SkImageFilter,
  SkPaint,
  SkPath,
  SkShader,
  SkSurface,
} from '@shopify/react-native-skia';

const TAU = Math.PI * 2;

/* ---------------------------------------------------------------- colors --- */

const COLOR_CACHE_MAX = 512;
const colorCache = new Map<string, SkColor>();

/**
 * What SkPaint.reset() used to leave in the colour slot. Built lazily so this
 * module can be imported before Skia's native side is up.
 */
let opaqueBlack: SkColor | null = null;
function blackColor(): SkColor {
  if (!opaqueBlack) opaqueBlack = Skia.Color('#000000');
  return opaqueBlack;
}

function parseColor(css: string): SkColor {
  const hit = colorCache.get(css);
  if (hit) return hit;
  // Waves builds ~14 alpha-interpolated strings a frame; without a cap this
  // map would grow all night long.
  if (colorCache.size >= COLOR_CACHE_MAX) colorCache.clear();
  const parsed = Skia.Color(css);
  colorCache.set(css, parsed);
  return parsed;
}

/* -------------------------------------------------------------- gradients --- */

/**
 * The object returned by createLinearGradient / createRadialGradient. A plain
 * descriptor: addColorStop collects stops, and the SkShader is built on first
 * use as a fillStyle (then memoized until the stops change).
 */
export class Gradient2D {
  private readonly positions: number[] = [];
  private readonly colors: SkColor[] = [];
  private shader: SkShader | null = null;

  constructor(
    private readonly kind: 'linear' | 'radial',
    private readonly coords: readonly number[],
  ) {}

  addColorStop(offset: number, color: string): void {
    this.positions.push(offset);
    this.colors.push(parseColor(color));
    this.shader = null;
  }

  /** @internal — used by Ctx2D when the gradient is a fill/stroke style. */
  makeShader(): SkShader {
    if (this.shader) return this.shader;
    const { coords, colors, positions } = this;
    if (this.kind === 'linear') {
      this.shader = Skia.Shader.MakeLinearGradient(
        { x: coords[0], y: coords[1] },
        { x: coords[2], y: coords[3] },
        colors,
        positions,
        TileMode.Clamp,
      );
    } else if (coords[2] > 0) {
      // Canvas2D radial gradients are two-point conicals; Skia's plain radial
      // only covers the r0 = 0 case (embers' vignette and the moon disc fill
      // both start from a non-zero inner radius).
      this.shader = Skia.Shader.MakeTwoPointConicalGradient(
        { x: coords[0], y: coords[1] },
        coords[2],
        { x: coords[3], y: coords[4] },
        coords[5],
        colors,
        positions,
        TileMode.Clamp,
      );
    } else {
      this.shader = Skia.Shader.MakeRadialGradient(
        { x: coords[3], y: coords[4] },
        coords[5],
        colors,
        positions,
        TileMode.Clamp,
      );
    }
    return this.shader;
  }
}

/* ---------------------------------------------------------------- filters --- */

const blurCache = new Map<number, SkImageFilter>();

function blurFilter(sigma: number): SkImageFilter {
  let f = blurCache.get(sigma);
  if (!f) {
    f = Skia.ImageFilter.MakeBlur(sigma, sigma, TileMode.Decal, null);
    blurCache.set(sigma, f);
  }
  return f;
}

const FILTER_RE = /^blur\(\s*(\d*\.?\d+)px\s*\)$/;

/* ------------------------------------------------------------------ types --- */

export type Ctx2DStyle = string | Gradient2D;
export type Ctx2DLineCap = 'butt' | 'round' | 'square';
export type Ctx2DCompositeOp = 'source-over' | 'lighter' | 'multiply' | 'destination-in';

const BLEND: Record<Ctx2DCompositeOp, BlendMode> = {
  'source-over': BlendMode.SrcOver,
  lighter: BlendMode.Plus,
  multiply: BlendMode.Multiply,
  'destination-in': BlendMode.DstIn,
};

const CAP: Record<Ctx2DLineCap, StrokeCap> = {
  butt: StrokeCap.Butt,
  round: StrokeCap.Round,
  square: StrokeCap.Square,
};

/** Canvas2D affine matrix (a, b, c, d, e, f): x' = ax + cy + e, y' = bx + dy + f. */
type Matrix2D = [number, number, number, number, number, number];

interface Ctx2DSnapshot {
  fillStyle: Ctx2DStyle;
  strokeStyle: Ctx2DStyle;
  lineWidth: number;
  lineCap: Ctx2DLineCap;
  globalAlpha: number;
  globalCompositeOperation: Ctx2DCompositeOp;
  filter: string;
  matrix: Matrix2D;
}

/* ---------------------------------------------------------------- batches --- */

/** Alpha levels an AlphaRectBatch can express. 0 and 1 are both exact. */
const ALPHA_BUCKETS = 32;

/**
 * A frame's worth of axis-aligned rects that share a fill style but differ in
 * opacity, grouped so that `Ctx2D.fillRectBatch` can draw each group as one
 * path instead of one rect at a time.
 *
 * Build one per scene at module scope and `reset()` it each frame: after the
 * first frame it allocates nothing at all.
 *
 * The trade, stated plainly: alpha is snapped to one of ALPHA_BUCKETS evenly
 * spaced levels, so it can be off by at most 1/(2*(ALPHA_BUCKETS-1)) — under
 * 1.7% of full opacity, which on the brightest starfield particle over a black
 * sky is under 4/255 of one channel. Nothing else changes: every rect is still
 * drawn, at its exact position and size. Two rects in the same bucket that
 * overlap now union instead of compositing twice, and rects land in bucket
 * order rather than insertion order — both are invisible for particles a
 * couple of pixels wide, and both would matter for large or opaque shapes.
 * This is for dust, not for scenery.
 */
export class AlphaRectBatch {
  readonly bucketCount: number;
  /** @internal — flat x,y,w,h runs, one array per bucket. */
  readonly data: number[][];
  /** @internal — live length of each bucket's array, a multiple of 4. */
  readonly counts: number[];
  /** One long-lived SkPath per bucket; see pathOf(). */
  private readonly paths: (SkPath | null)[];

  constructor(buckets: number = ALPHA_BUCKETS) {
    this.bucketCount = Math.max(2, Math.round(buckets));
    this.data = new Array(this.bucketCount);
    this.counts = new Array(this.bucketCount).fill(0);
    this.paths = new Array(this.bucketCount).fill(null);
    for (let i = 0; i < this.bucketCount; i += 1) this.data[i] = [];
  }

  /** Drop last frame's contents without releasing the backing arrays. */
  reset(): void {
    this.counts.fill(0);
  }

  add(x: number, y: number, w: number, h: number, alpha: number): void {
    const a = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
    const b = Math.round(a * (this.bucketCount - 1));
    const arr = this.data[b];
    let n = this.counts[b];
    arr[n] = x;
    arr[n + 1] = y;
    arr[n + 2] = w;
    arr[n + 3] = h;
    n += 4;
    this.counts[b] = n;
  }

  /** @internal — the alpha every rect in bucket `b` is drawn at. */
  alphaOf(b: number): number {
    return b / (this.bucketCount - 1);
  }

  /**
   * @internal — bucket `b`'s path, emptied and ready to fill.
   *
   * Kept rather than rebuilt: drawPath snapshots the builder (a copy — the
   * recording is not disturbed by a later reset), so one path per bucket for
   * the life of the scene costs nothing and saves a native host object,
   * complete with its Hermes memory-pressure report, per bucket per frame.
   */
  pathOf(b: number): SkPath {
    const hit = this.paths[b];
    if (hit) {
      hit.reset();
      return hit;
    }
    const made = Skia.Path.Make();
    this.paths[b] = made;
    return made;
  }
}

/* ------------------------------------------------------------------- Ctx2D --- */

export class Ctx2D {
  fillStyle: Ctx2DStyle = '#000000';
  strokeStyle: Ctx2DStyle = '#000000';
  lineWidth = 1;
  lineCap: Ctx2DLineCap = 'butt';
  globalAlpha = 1;
  globalCompositeOperation: Ctx2DCompositeOp = 'source-over';
  filter = 'none';

  /** JS mirror of the CTM — only needed so setTransform can replace it. */
  private readonly matrix: Matrix2D = [1, 0, 0, 1, 0, 0];
  /**
   * save()/restore() scratch. Pooled and indexed by `depth` rather than
   * push/pop: moonrise saves and restores dozens of times a frame and every
   * one of those was a fresh snapshot object plus a fresh matrix array.
   */
  private readonly stack: Ctx2DSnapshot[] = [];
  private depth = 0;
  private path: SkPath = Skia.Path.Make();
  private readonly paint: SkPaint = Skia.Paint();
  private lastFilterSrc = 'none';
  private lastSigma = 0;

  /* Reused rect literals — Skia reads these synchronously inside the native
   * call and never retains them, so one per role is enough for the lifetime
   * of the context. */
  private readonly rect = { x: 0, y: 0, width: 0, height: 0 };
  private readonly srcRect = { x: 0, y: 0, width: 0, height: 0 };
  private readonly oval = { x: 0, y: 0, width: 0, height: 0 };

  /* ------------------------------------------------- paint mirror (JS) --- *
   * What the SkPaint currently holds, for every field this class writes.
   * Seeded from the documented defaults of a freshly constructed SkPaint,
   * except antiAlias which the constructor turns on once and never off.
   * `pColor` is null for "RGB unknown", which forces the next setColor. */
  private pColor: SkColor | null = null;
  private pAlpha = 1;
  private pShader: SkShader | null = null;
  private pDither = false;
  private pSigma = 0;
  private pBlend: BlendMode = BlendMode.SrcOver;
  private pStyle: PaintStyle = PaintStyle.Fill;
  private pStrokeWidth = 0;
  private pCap: StrokeCap = StrokeCap.Butt;

  constructor(
    private readonly canvas: SkCanvas,
    private readonly onDraw?: () => void,
  ) {
    this.paint.setAntiAlias(true);
  }

  /**
   * Release the native paint and path this context owns.
   *
   * Only legal once the context is finished with — the SkCanvas has copied
   * every paint and snapshotted every path into the recording by then, so
   * nothing downstream still reads them. Do NOT call this on an
   * OffscreenSprite's context: that one outlives the frame it was drawn in.
   */
  dispose(): void {
    this.paint.dispose();
    this.path.dispose();
  }

  /* ------------------------------------------------------------- state --- */

  save(): void {
    this.canvas.save();
    let s = this.stack[this.depth];
    if (!s) {
      s = {
        fillStyle: this.fillStyle,
        strokeStyle: this.strokeStyle,
        lineWidth: this.lineWidth,
        lineCap: this.lineCap,
        globalAlpha: this.globalAlpha,
        globalCompositeOperation: this.globalCompositeOperation,
        filter: this.filter,
        matrix: [0, 0, 0, 0, 0, 0],
      };
      this.stack[this.depth] = s;
    }
    s.fillStyle = this.fillStyle;
    s.strokeStyle = this.strokeStyle;
    s.lineWidth = this.lineWidth;
    s.lineCap = this.lineCap;
    s.globalAlpha = this.globalAlpha;
    s.globalCompositeOperation = this.globalCompositeOperation;
    s.filter = this.filter;
    const m = this.matrix;
    const sm = s.matrix;
    sm[0] = m[0];
    sm[1] = m[1];
    sm[2] = m[2];
    sm[3] = m[3];
    sm[4] = m[4];
    sm[5] = m[5];
    this.depth += 1;
  }

  restore(): void {
    if (this.depth === 0) return; // Canvas2D ignores an unbalanced restore
    this.depth -= 1;
    const s = this.stack[this.depth];
    this.canvas.restore();
    this.fillStyle = s.fillStyle;
    this.strokeStyle = s.strokeStyle;
    this.lineWidth = s.lineWidth;
    this.lineCap = s.lineCap;
    this.globalAlpha = s.globalAlpha;
    this.globalCompositeOperation = s.globalCompositeOperation;
    this.filter = s.filter;
    const m = this.matrix;
    const sm = s.matrix;
    m[0] = sm[0];
    m[1] = sm[1];
    m[2] = sm[2];
    m[3] = sm[3];
    m[4] = sm[4];
    m[5] = sm[5];
  }

  /* --------------------------------------------------------- transforms --- */

  translate(x: number, y: number): void {
    this.canvas.translate(x, y);
    const m = this.matrix;
    m[4] = m[0] * x + m[2] * y + m[4];
    m[5] = m[1] * x + m[3] * y + m[5];
  }

  scale(sx: number, sy: number): void {
    this.canvas.scale(sx, sy);
    const m = this.matrix;
    m[0] *= sx;
    m[1] *= sx;
    m[2] *= sy;
    m[3] *= sy;
  }

  /**
   * Replace the CTM (Canvas2D semantics). SkCanvas has no setMatrix, so the
   * delta inv(current) x target is concatenated instead — exact, and it keeps
   * SkCanvas's own save/restore stack authoritative.
   */
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void {
    const m = this.matrix;
    const det = m[0] * m[3] - m[2] * m[1];
    if (det === 0) return; // degenerate CTM — nothing sensible to do
    const ia = m[3] / det;
    const ib = -m[1] / det;
    const ic = -m[2] / det;
    const id = m[0] / det;
    const ie = (m[2] * m[5] - m[3] * m[4]) / det;
    const iff = (m[1] * m[4] - m[0] * m[5]) / det;
    this.canvas.concat([
      ia * a + ic * b,
      ia * c + ic * d,
      ia * e + ic * f + ie,
      ib * a + id * b,
      ib * c + id * d,
      ib * e + id * f + iff,
      0,
      0,
      1,
    ]);
    // In place: the inverse above is fully evaluated before this point, and
    // the snapshot stack keeps its own copy.
    m[0] = a;
    m[1] = b;
    m[2] = c;
    m[3] = d;
    m[4] = e;
    m[5] = f;
  }

  /* --------------------------------------------------------------- paths --- */

  beginPath(): void {
    // The outgoing path is provably dead: drawPath/clipPath snapshot it into
    // the recording (JsiSkCanvas::drawPath calls path->snapshot()), and this
    // field is the only reference that ever escapes. Releasing it here keeps
    // ~20 native paths a frame off Hermes' external-memory pressure counter.
    this.path.dispose();
    this.path = Skia.Path.Make();
  }

  moveTo(x: number, y: number): void {
    this.path.moveTo(x, y);
  }

  lineTo(x: number, y: number): void {
    this.path.lineTo(x, y);
  }

  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void {
    this.path.quadTo(cpx, cpy, x, y);
  }

  closePath(): void {
    this.path.close();
  }

  arc(x: number, y: number, r: number, startAngle: number, endAngle: number, ccw = false): void {
    this.ovalArc(x, y, r, r, startAngle, endAngle, ccw);
  }

  ellipse(
    x: number,
    y: number,
    rx: number,
    ry: number,
    rotation: number,
    startAngle: number,
    endAngle: number,
    ccw = false,
  ): void {
    if (rotation !== 0) {
      throw new Error('Ctx2D.ellipse: only rotation 0 is supported');
    }
    this.ovalArc(x, y, rx, ry, startAngle, endAngle, ccw);
  }

  /**
   * Canvas2D arc semantics on a Skia path. Sweep normalization follows the
   * HTML spec: >= 2π one way means a full lap, anything else is reduced
   * modulo 2π in the requested direction. Skia draws nothing for a single
   * 360° arcTo, so a full circle goes down as two half sweeps (the same trick
   * CanvasKit's own Canvas2D emulation uses).
   */
  private ovalArc(
    x: number,
    y: number,
    rx: number,
    ry: number,
    a0: number,
    a1: number,
    ccw: boolean,
  ): void {
    let sweep = a1 - a0;
    if (!ccw) {
      if (sweep >= TAU) {
        sweep = TAU;
      } else {
        sweep %= TAU;
        if (sweep < 0) sweep += TAU;
      }
    } else if (sweep <= -TAU) {
      sweep = -TAU;
    } else {
      sweep %= TAU;
      if (sweep > 0) sweep -= TAU;
    }

    const oval = this.oval;
    oval.x = x - rx;
    oval.y = y - ry;
    oval.width = rx * 2;
    oval.height = ry * 2;
    const startDeg = (a0 * 180) / Math.PI;
    const sweepDeg = (sweep * 180) / Math.PI;
    // forceMoveTo=false lines from the previous point to the arc start, as
    // Canvas2D does; Skia flips it to true by itself when the path is empty.
    if (Math.abs(sweepDeg) >= 360 - 1e-6) {
      const half = sweepDeg / 2;
      this.path.arcToOval(oval, startDeg, half, false);
      this.path.arcToOval(oval, startDeg + half, half, false);
    } else {
      this.path.arcToOval(oval, startDeg, sweepDeg, false);
    }
  }

  fill(): void {
    this.canvas.drawPath(this.path, this.stylePaint(this.fillStyle, false));
    this.dirty();
  }

  stroke(): void {
    this.canvas.drawPath(this.path, this.stylePaint(this.strokeStyle, true));
    this.dirty();
  }

  clip(): void {
    this.canvas.clipPath(this.path, ClipOp.Intersect, true);
  }

  /* --------------------------------------------------------------- rects --- */

  fillRect(x: number, y: number, w: number, h: number): void {
    const r = this.rect;
    r.x = x;
    r.y = y;
    r.width = w;
    r.height = h;
    this.canvas.drawRect(r, this.stylePaint(this.fillStyle, false));
    this.dirty();
  }

  /**
   * Fill a whole batch of axis-aligned rects that share `fillStyle` but not
   * opacity, as one path per alpha bucket.
   *
   * The starfield is 150 one-to-three pixel squares whose only per-particle
   * difference is opacity; drawn one at a time that is 150 records in the
   * picture and 150 paint reconfigurations. Every rect is still drawn, at its
   * exact position and size — only the alpha is snapped to its bucket. See
   * AlphaRectBatch for the error bound.
   */
  fillRectBatch(batch: AlphaRectBatch): void {
    const savedAlpha = this.globalAlpha;
    const r = this.rect;
    for (let b = 0; b < batch.bucketCount; b += 1) {
      const n = batch.counts[b];
      if (n === 0) continue;
      const data = batch.data[b];
      const path = batch.pathOf(b);
      for (let i = 0; i < n; i += 4) {
        r.x = data[i];
        r.y = data[i + 1];
        r.width = data[i + 2];
        r.height = data[i + 3];
        path.addRect(r);
      }
      this.globalAlpha = savedAlpha * batch.alphaOf(b);
      this.canvas.drawPath(path, this.stylePaint(this.fillStyle, false));
      this.dirty();
    }
    this.globalAlpha = savedAlpha;
  }

  /* ----------------------------------------------------------- gradients --- */

  createLinearGradient(x0: number, y0: number, x1: number, y1: number): Gradient2D {
    return new Gradient2D('linear', [x0, y0, x1, y1]);
  }

  createRadialGradient(
    x0: number,
    y0: number,
    r0: number,
    x1: number,
    y1: number,
    r1: number,
  ): Gradient2D {
    return new Gradient2D('radial', [x0, y0, r0, x1, y1, r1]);
  }

  /* -------------------------------------------------------------- images --- */

  drawImage(source: OffscreenSprite, dx: number, dy: number, dw?: number, dh?: number): void {
    const image = source.snapshot();
    const src = this.srcRect;
    src.x = 0;
    src.y = 0;
    src.width = source.width;
    src.height = source.height;
    const dst = this.rect;
    dst.x = dx;
    dst.y = dy;
    dst.width = dw ?? source.width;
    dst.height = dh ?? source.height;
    // Linear sampling to match the web's default image smoothing —
    // drawImageRect without options samples nearest-neighbor.
    this.canvas.drawImageRectOptions(
      image,
      src,
      dst,
      FilterMode.Linear,
      MipmapMode.None,
      this.imagePaint(),
    );
    this.dirty();
  }

  /* -------------------------------------------------------------- paints --- */

  /**
   * Blend mode + blur, the two fields every draw shares. antiAlias is set once
   * in the constructor and never cleared, which is what reset() + setAntiAlias
   * used to re-establish on every call.
   */
  private basePaint(): SkPaint {
    const p = this.paint;
    const blend = BLEND[this.globalCompositeOperation];
    if (this.pBlend !== blend) {
      p.setBlendMode(blend);
      this.pBlend = blend;
    }
    const sigma = this.currentBlurSigma();
    if (this.pSigma !== sigma) {
      p.setImageFilter(sigma > 0 ? blurFilter(sigma) : null);
      this.pSigma = sigma;
    }
    return p;
  }

  /** setColor writes RGBA; setAlphaf then overrides just the alpha. */
  private applyColor(color: SkColor, alpha: number): void {
    if (this.pColor !== color) {
      // parseColor hands back the same SkColor object for the same string, so
      // identity is a sound (and conservative — a cache clear only costs one
      // extra write) test for "the paint already holds this colour".
      this.paint.setColor(color);
      this.pColor = color;
      this.pAlpha = color[3];
    }
    if (this.pAlpha !== alpha) {
      this.paint.setAlphaf(alpha);
      this.pAlpha = alpha;
    }
  }

  private applyAlpha(alpha: number): void {
    if (this.pAlpha === alpha) return;
    this.paint.setAlphaf(alpha);
    this.pAlpha = alpha;
  }

  /** What reset() used to guarantee for every non-gradient draw. */
  private clearShader(): void {
    if (this.pShader !== null) {
      this.paint.setShader(null);
      this.pShader = null;
    }
    if (this.pDither) {
      this.paint.setDither(false);
      this.pDither = false;
    }
  }

  private applyStyle(forStroke: boolean): void {
    const p = this.paint;
    const style = forStroke ? PaintStyle.Stroke : PaintStyle.Fill;
    if (this.pStyle !== style) {
      p.setStyle(style);
      this.pStyle = style;
    }
    if (!forStroke) return;
    if (this.pStrokeWidth !== this.lineWidth) {
      p.setStrokeWidth(this.lineWidth);
      this.pStrokeWidth = this.lineWidth;
    }
    const cap = CAP[this.lineCap];
    if (this.pCap !== cap) {
      p.setStrokeCap(cap);
      this.pCap = cap;
    }
  }

  private stylePaint(style: Ctx2DStyle, forStroke: boolean): SkPaint {
    const p = this.basePaint();
    if (typeof style === 'string') {
      this.clearShader();
      const color = parseColor(style);
      this.applyColor(color, color[3] * this.globalAlpha);
    } else {
      const shader = style.makeShader();
      if (this.pShader !== shader) {
        p.setShader(shader);
        this.pShader = shader;
      }
      // The scenes lean on big, slow gradients; dithering keeps them from
      // banding on 8-bit surfaces the way browsers quietly do.
      if (!this.pDither) {
        p.setDither(true);
        this.pDither = true;
      }
      // A shader ignores the paint's RGB but not its alpha, and reset() used
      // to leave that at 1 — so it has to be written, not skipped.
      this.applyAlpha(this.globalAlpha);
    }
    this.applyStyle(forStroke);
    return p;
  }

  private imagePaint(): SkPaint {
    const p = this.basePaint();
    this.clearShader();
    this.applyStyle(false);
    // Skia only reads the paint's alpha when blitting a colour image, but it
    // reads the whole colour for an alpha-only one, and being wrong about that
    // is a tint on every sprite in the app. Restore what reset() left instead
    // of reasoning about it — the mirror makes a run of blits cost one write.
    this.applyColor(blackColor(), this.globalAlpha);
    return p;
  }

  private currentBlurSigma(): number {
    const f = this.filter;
    if (f === 'none' || f === '') return 0;
    if (f !== this.lastFilterSrc) {
      const m = FILTER_RE.exec(f);
      if (!m) {
        throw new Error(`Ctx2D: unsupported filter "${f}" (only "blur(Npx)" and "none")`);
      }
      this.lastFilterSrc = f;
      this.lastSigma = parseFloat(m[1]);
    }
    return this.lastSigma;
  }

  private dirty(): void {
    this.onDraw?.();
  }
}

/* ------------------------------------------------------------------ sprites --- */

/**
 * The replacement for document.createElement('canvas'): an offscreen Skia
 * raster surface with its own Ctx2D. Scenes draw a sprite once at build time
 * and then blit it every frame; the SkImage snapshot is taken lazily and
 * invalidated if the sprite is ever drawn into again.
 */
export class OffscreenSprite {
  readonly width: number;
  readonly height: number;
  readonly ctx: Ctx2D;
  private readonly surface: SkSurface;
  private image: SkImage | null = null;

  constructor(width: number, height: number) {
    this.width = Math.max(1, Math.round(width));
    this.height = Math.max(1, Math.round(height));
    const surface = Skia.Surface.Make(this.width, this.height);
    if (!surface) {
      throw new Error(`OffscreenSprite: Surface.Make(${this.width}, ${this.height}) failed`);
    }
    this.surface = surface;
    this.ctx = new Ctx2D(surface.getCanvas(), () => {
      // The stale snapshot is dead the moment the pixels change: any picture
      // that already blitted it holds its own native reference, and this field
      // is the only JS one.
      this.image?.dispose();
      this.image = null;
    });
  }

  /** @internal — current pixels as an SkImage, cached between draws. */
  snapshot(): SkImage {
    if (!this.image) {
      this.surface.flush();
      this.image = this.surface.makeImageSnapshot();
    }
    return this.image;
  }

  /**
   * Release the raster surface, its context and the last snapshot.
   *
   * Only for a sprite that will never be drawn from again — moonrise rebuilds
   * about nine of these on every init and they are the largest native objects
   * the scene layer owns. A picture already recorded keeps its own native
   * reference to the SkImage it blitted, so dropping ours does not disturb a
   * frame that is still on screen; calling `snapshot()` afterwards would
   * throw, which is the point.
   */
  dispose(): void {
    this.image?.dispose();
    this.image = null;
    this.ctx.dispose();
    this.surface.dispose();
  }
}

export function createSprite(width: number, height: number): OffscreenSprite {
  return new OffscreenSprite(width, height);
}
