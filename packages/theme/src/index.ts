// Сборка темы витрины: пресет (JSON) → CSS-переменные + проверка контраста.
// Компоненты используют только семантические роли (--bg, --brand, --accent …), см. DESIGN.md §2.

export interface ThemePreset {
  id: string;
  mode: 'dark' | 'light';
  colors: { brand: string; accent: string; bg: string; surface: string; text?: string };
  shape: 'sharp' | 'soft';
  font: { display: string; displayWeight: number; displayCase: 'upper' | 'normal' };
  pattern: { kind: 'ice' | 'grass' | 'parquet' | 'grid' | 'noise'; intensity: number };
  slots: { logo: string | null; banner: string | null; venuePhoto: string | null };
}

type RGB = [number, number, number];

const hexToRgb = (hex: string): RGB => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgbToHex = (c: RGB) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

const lum = (hex: string) => {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/** Смешивает цвет с белым (t>0) или чёрным (t<0). */
const shift = (hex: string, t: number): string => {
  const c = hexToRgb(hex);
  const target = t > 0 ? 255 : 0;
  const k = Math.abs(t);
  return rgbToHex(c.map((v) => v + (target - v) * k) as RGB);
};

const onColor = (bg: string) => (contrast(bg, '#ffffff') >= contrast(bg, '#0b0d12') ? '#ffffff' : '#0b0d12');

export interface BuiltTheme {
  css: string;
  checks: { pair: string; ratio: number; min: number; ok: boolean }[];
}

export function buildTheme(p: ThemePreset): BuiltTheme {
  const dark = p.mode === 'dark';
  const { brand, accent, bg, surface } = p.colors;
  const text = p.colors.text ?? (dark ? '#EEF2F8' : '#10141C');
  const muted = dark ? shift(text, -0.32) : shift(text, 0.38);
  const vars: Record<string, string> = {
    '--bg': bg,
    '--bg-elevated': shift(bg, dark ? 0.05 : -0.03),
    '--surface': surface,
    '--surface-2': shift(surface, dark ? 0.07 : -0.04),
    '--border': shift(surface, dark ? 0.14 : -0.1),
    '--border-strong': shift(surface, dark ? 0.28 : -0.22),
    '--text': text,
    '--text-muted': muted,
    '--brand': brand,
    '--on-brand': onColor(brand),
    '--accent': accent,
    '--on-accent': onColor(accent),
    '--focus': dark ? '#7FB3FF' : '#1F5FD1',
    '--font-display': `'${p.font.display}', 'Inter', system-ui, sans-serif`,
    '--display-weight': String(p.font.displayWeight),
    '--display-case': p.font.displayCase === 'upper' ? 'uppercase' : 'none',
    '--pattern-intensity': String(p.pattern.intensity),
    ...(p.shape === 'sharp'
      ? { '--radius-sm': '2px', '--radius-md': '4px', '--radius-lg': '8px' }
      : { '--radius-sm': '8px', '--radius-md': '12px', '--radius-lg': '20px' }),
  };

  const checks = [
    { pair: 'text/bg', ratio: contrast(text, bg), min: 4.5 },
    { pair: 'text/surface', ratio: contrast(text, surface), min: 4.5 },
    { pair: 'muted/surface', ratio: contrast(muted, surface), min: 4.5 },
    { pair: 'on-accent/accent', ratio: contrast(vars['--on-accent'], accent), min: 4.5 },
    { pair: 'on-brand/brand', ratio: contrast(vars['--on-brand'], brand), min: 4.5 },
    { pair: 'focus/bg', ratio: contrast(vars['--focus'], bg), min: 3 },
  ].map((c) => ({ ...c, ratio: Math.round(c.ratio * 100) / 100, ok: c.ratio >= c.min }));

  const failed = checks.filter((c) => !c.ok);
  if (failed.length) {
    throw new Error(
      `Тема «${p.id}» не прошла проверку контраста: ` +
        failed.map((f) => `${f.pair} = ${f.ratio} (нужно ≥ ${f.min})`).join('; '),
    );
  }

  const css = `:root{${Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';')}}`;
  return { css, checks };
}
