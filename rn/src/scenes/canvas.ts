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
 *     into the recording), reset and reconfigured per op — an all-night app
 *     cannot afford a paint allocation per star per frame.
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
  private matrix: Matrix2D = [1, 0, 0, 1, 0, 0];
  private readonly stack: Ctx2DSnapshot[] = [];
  private path: SkPath = Skia.Path.Make();
  private readonly paint: SkPaint = Skia.Paint();
  private lastFilterSrc = 'none';
  private lastSigma = 0;

  constructor(
    private readonly canvas: SkCanvas,
    private readonly onDraw?: () => void,
  ) {}

  /* ------------------------------------------------------------- state --- */

  save(): void {
    this.canvas.save();
    this.stack.push({
      fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth,
      lineCap: this.lineCap,
      globalAlpha: this.globalAlpha,
      globalCompositeOperation: this.globalCompositeOperation,
      filter: this.filter,
      matrix: [...this.matrix],
    });
  }

  restore(): void {
    const s = this.stack.pop();
    if (!s) return; // Canvas2D ignores an unbalanced restore
    this.canvas.restore();
    this.fillStyle = s.fillStyle;
    this.strokeStyle = s.strokeStyle;
    this.lineWidth = s.lineWidth;
    this.lineCap = s.lineCap;
    this.globalAlpha = s.globalAlpha;
    this.globalCompositeOperation = s.globalCompositeOperation;
    this.filter = s.filter;
    this.matrix = s.matrix;
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
    this.matrix = [a, b, c, d, e, f];
  }

  /* --------------------------------------------------------------- paths --- */

  beginPath(): void {
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

    const oval = { x: x - rx, y: y - ry, width: rx * 2, height: ry * 2 };
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
    this.canvas.drawRect({ x, y, width: w, height: h }, this.stylePaint(this.fillStyle, false));
    this.dirty();
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
    const w = dw ?? source.width;
    const h = dh ?? source.height;
    // Linear sampling to match the web's default image smoothing —
    // drawImageRect without options samples nearest-neighbor.
    this.canvas.drawImageRectOptions(
      image,
      { x: 0, y: 0, width: source.width, height: source.height },
      { x: dx, y: dy, width: w, height: h },
      FilterMode.Linear,
      MipmapMode.None,
      this.imagePaint(),
    );
    this.dirty();
  }

  /* -------------------------------------------------------------- paints --- */

  private basePaint(): SkPaint {
    const p = this.paint;
    p.reset();
    p.setAntiAlias(true);
    p.setBlendMode(BLEND[this.globalCompositeOperation]);
    const sigma = this.currentBlurSigma();
    if (sigma > 0) p.setImageFilter(blurFilter(sigma));
    return p;
  }

  private stylePaint(style: Ctx2DStyle, forStroke: boolean): SkPaint {
    const p = this.basePaint();
    if (typeof style === 'string') {
      const color = parseColor(style);
      p.setColor(color);
      if (this.globalAlpha !== 1) p.setAlphaf(color[3] * this.globalAlpha);
    } else {
      p.setShader(style.makeShader());
      // The scenes lean on big, slow gradients; dithering keeps them from
      // banding on 8-bit surfaces the way browsers quietly do.
      p.setDither(true);
      if (this.globalAlpha !== 1) p.setAlphaf(this.globalAlpha);
    }
    if (forStroke) {
      p.setStyle(PaintStyle.Stroke);
      p.setStrokeWidth(this.lineWidth);
      p.setStrokeCap(CAP[this.lineCap]);
    }
    return p;
  }

  private imagePaint(): SkPaint {
    const p = this.basePaint();
    if (this.globalAlpha !== 1) p.setAlphaf(this.globalAlpha);
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
}

export function createSprite(width: number, height: number): OffscreenSprite {
  return new OffscreenSprite(width, height);
}
