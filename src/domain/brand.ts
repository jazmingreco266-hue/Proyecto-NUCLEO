/**
 * Identidad de marca del cliente: colores, fuentes e imágenes.
 *
 * Los colores los define el cliente; acá solo se calculan variantes accesibles (contraste WCAG 2.2)
 * para que textos y botones se lean bien sin cambiar la identidad.
 */

// ── Colores ─────────────────────────────────────────────────────────────

export const HEX = /^#[0-9a-f]{6}$/i;

type Rgb = [number, number, number];

function rgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

/** Luminancia relativa (WCAG 2.2). */
export function luminance(color: string): number {
  const [r, g, b] = rgb(color).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Relación de contraste entre dos colores (1 a 21). */
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

/** Mezcla dos colores: t = 0 devuelve a, t = 1 devuelve b. */
export function mix(a: string, b: string, t: number): string {
  const [p, q] = [rgb(a), rgb(b)];
  return hex([0, 1, 2].map((i) => p[i]! + (q[i]! - p[i]!) * t) as Rgb);
}

/** Texto normal: mínimo AA de WCAG. */
export const MIN_TEXT_CONTRAST = 4.5;

/**
 * Acerca `color` a `toward` lo mínimo necesario para llegar al contraste pedido sobre `bg`.
 * Si ya lo cumple, lo devuelve igual: la identidad se toca solo cuando hace falta.
 */
export function ensureContrast(color: string, bg: string, toward: string, min = MIN_TEXT_CONTRAST): string {
  if (contrast(color, bg) >= min) return color;
  for (let t = 0.05; t <= 1.0001; t += 0.05) {
    const c = mix(color, toward, t);
    if (contrast(c, bg) >= min) return c;
  }
  return toward;
}

export type BrandColors = { primary: string; secondary: string | null; background: string; text: string };

export type Palette = {
  brand: string;
  /** Color de marca usado como texto (enlaces, detalles) con contraste suficiente sobre el fondo. */
  brandInk: string;
  /** Fondo de botones y texto encima, con contraste suficiente. */
  button: string;
  onButton: string;
  secondary: string;
  bg: string;
  text: string;
  muted: string;
  line: string;
  tint: string;
  adjusted: string[];
};

export function palette(c: BrandColors): Palette {
  const adjusted: string[] = [];
  const dark = luminance(c.background) < 0.4;
  const extreme = dark ? "#ffffff" : "#000000";

  const brandInk = ensureContrast(c.primary, c.background, c.text);
  if (brandInk !== c.primary) adjusted.push("El color principal se oscureció un poco solo donde se usa como texto, para que se lea.");

  // Botón: color de marca con el texto (blanco o casi negro) que más contraste tenga.
  const white = "#ffffff";
  const ink = "#111111";
  let button = c.primary;
  let onButton = contrast(white, button) >= contrast(ink, button) ? white : ink;
  if (contrast(onButton, button) < MIN_TEXT_CONTRAST) {
    button = ensureContrast(button, onButton, onButton === white ? "#000000" : "#ffffff");
    adjusted.push("El fondo de los botones se ajustó levemente para que el texto se lea.");
  }

  const muted = (() => {
    for (let t = 0.4; t >= 0; t -= 0.05) {
      const m = mix(c.text, c.background, t);
      if (contrast(m, c.background) >= MIN_TEXT_CONTRAST) return m;
    }
    return c.text;
  })();

  return {
    brand: c.primary,
    brandInk,
    button,
    onButton,
    secondary: c.secondary ?? brandInk,
    bg: c.background,
    text: contrast(c.text, c.background) >= MIN_TEXT_CONTRAST ? c.text : ensureContrast(c.text, c.background, extreme),
    muted,
    line: mix(c.background, c.text, 0.12),
    tint: mix(c.background, c.primary, dark ? 0.12 : 0.06),
    adjusted,
  };
}

// ── Fuentes ─────────────────────────────────────────────────────────────

/**
 * Fuentes de Google Fonts (licencia libre) con los pesos que existen en cada una.
 * "Sistema" usa las fuentes del dispositivo, sin descargar nada.
 */
export const FONTS = {
  Sistema: { stack: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', weights: [] as number[], serif: false },
  Inter: { stack: '"Inter", system-ui, sans-serif', weights: [400, 600, 700], serif: false },
  Manrope: { stack: '"Manrope", system-ui, sans-serif', weights: [400, 600, 700], serif: false },
  "DM Sans": { stack: '"DM Sans", system-ui, sans-serif', weights: [400, 600, 700], serif: false },
  "Work Sans": { stack: '"Work Sans", system-ui, sans-serif', weights: [400, 600, 700], serif: false },
  "Source Sans 3": { stack: '"Source Sans 3", system-ui, sans-serif', weights: [400, 600, 700], serif: false },
  "Nunito Sans": { stack: '"Nunito Sans", system-ui, sans-serif', weights: [400, 600, 700], serif: false },
  Montserrat: { stack: '"Montserrat", system-ui, sans-serif', weights: [400, 600, 700], serif: false },
  Poppins: { stack: '"Poppins", system-ui, sans-serif', weights: [400, 600, 700], serif: false },
  Raleway: { stack: '"Raleway", system-ui, sans-serif', weights: [400, 600, 700], serif: false },
  Lato: { stack: '"Lato", system-ui, sans-serif', weights: [400, 700], serif: false },
  "Open Sans": { stack: '"Open Sans", system-ui, sans-serif', weights: [400, 600, 700], serif: false },
  Roboto: { stack: '"Roboto", system-ui, sans-serif', weights: [400, 500, 700], serif: false },
  "Playfair Display": { stack: '"Playfair Display", Georgia, serif', weights: [400, 600, 700], serif: true },
  Lora: { stack: '"Lora", Georgia, serif', weights: [400, 600, 700], serif: true },
  Merriweather: { stack: '"Merriweather", Georgia, serif', weights: [400, 700], serif: true },
  Fraunces: { stack: '"Fraunces", Georgia, serif', weights: [400, 600, 700], serif: true },
  "Libre Baskerville": { stack: '"Libre Baskerville", Georgia, serif', weights: [400, 700], serif: true },
  "Cormorant Garamond": { stack: '"Cormorant Garamond", Georgia, serif', weights: [400, 600, 700], serif: true },
  "DM Serif Display": { stack: '"DM Serif Display", Georgia, serif', weights: [400], serif: true },
  "Source Serif 4": { stack: '"Source Serif 4", Georgia, serif', weights: [400, 600, 700], serif: true },
} as const;

export type FontName = keyof typeof FONTS;
export const FONT_NAMES = Object.keys(FONTS) as FontName[];

/** Enlace a Google Fonts para las fuentes elegidas, o null si no hace falta descargar ninguna. */
export function googleFontsHref(fonts: FontName[]): string | null {
  const families = [...new Set(fonts)]
    .filter((f) => FONTS[f].weights.length > 0)
    .map((f) => `family=${f.replace(/ /g, "+")}:wght@${FONTS[f].weights.join(";")}`);
  return families.length ? `https://fonts.googleapis.com/css2?${families.join("&")}&display=swap` : null;
}

// ── Imágenes ────────────────────────────────────────────────────────────

export const IMAGE_MIMES = ["image/png", "image/jpeg", "image/webp"] as const;
export type ImageMime = (typeof IMAGE_MIMES)[number];
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const MAX_PHOTOS = 6;
export const IMAGE_EXT: Record<ImageMime, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export type ImageInfo = { mime: ImageMime; width: number; height: number };

/**
 * Reconoce el tipo real de la imagen por su contenido (no por el nombre del archivo) y lee sus medidas.
 * Devuelve null si no es PNG, JPEG o WebP válido. SVG no se acepta: puede traer código ejecutable.
 */
export function inspectImage(b: Uint8Array): ImageInfo | null {
  const u32 = (o: number) => ((b[o]! << 24) | (b[o + 1]! << 16) | (b[o + 2]! << 8) | b[o + 3]!) >>> 0;
  const u16 = (o: number) => (b[o]! << 8) | b[o + 1]!;
  const le16 = (o: number) => b[o]! | (b[o + 1]! << 8);
  const le24 = (o: number) => b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16);
  const ok = (w: number, h: number, mime: ImageMime) => (w > 0 && h > 0 && w <= 20000 && h <= 20000 ? { mime, width: w, height: h } : null);

  // PNG: firma + bloque IHDR.
  if (b.length >= 24 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) {
    if (String.fromCharCode(...b.slice(12, 16)) !== "IHDR") return null;
    return ok(u32(16), u32(20), "image/png");
  }
  // JPEG: busca el marcador SOF con las medidas.
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let o = 2;
    while (o + 9 < b.length) {
      if (b[o] !== 0xff) return null;
      const marker = b[o + 1]!;
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
        o += 2;
        continue;
      }
      const len = u16(o + 2);
      if (len < 2) return null;
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return ok(u16(o + 7), u16(o + 5), "image/jpeg");
      }
      o += 2 + len;
    }
    return null;
  }
  // WebP: contenedor RIFF con bloque VP8, VP8L o VP8X.
  if (b.length >= 30 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") {
    const chunk = String.fromCharCode(...b.slice(12, 16));
    if (chunk === "VP8 ") return ok(le16(26) & 0x3fff, le16(28) & 0x3fff, "image/webp");
    if (chunk === "VP8L" && b[20] === 0x2f) {
      const bits = b[21]! | (b[22]! << 8) | (b[23]! << 16) | (b[24]! << 24);
      return ok((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1, "image/webp");
    }
    if (chunk === "VP8X") return ok(le24(24) + 1, le24(27) + 1, "image/webp");
    return null;
  }
  return null;
}
