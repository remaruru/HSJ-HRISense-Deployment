/**
 * Chart colours for Reports & Analytics.
 *
 * Every value here was produced by running the palette validator, not by eye.
 * Each set passes lightness band, chroma floor, colour-blind separation, the
 * normal-vision floor and contrast against its own surface, in its own mode —
 * dark is a separately chosen set, never a flip of the light one.
 *
 *   status  light  #15803d #f59e0b #dc2626 #7c3aed   all checks pass
 *           dark   #059669 #d97706 #e11d48 #8b5cf6   all checks pass
 *   ordinal light  #4db8b6 #148281 #0d6362 #0a4a49   all checks pass
 *           dark   #c2e8e7 #8ed4d2 #4db8b6 #148281   all checks pass
 *
 * Two validator warnings are carried deliberately, each with the relief the
 * method requires:
 *   · light amber sits at 2.09:1 on white — every bar carries a visible value
 *     label and the full table sits under the charts, so no figure is colour-only.
 *   · dark green↔amber separate by ΔE 7.9 (the 6–8 floor band) — the charts ship
 *     a legend, direct labels and an icon per status, so identity never rests on
 *     hue alone.
 *
 * Status colours are reserved. A status hue never doubles as "series 4".
 */

export type ReportTone = 'good' | 'warning' | 'critical' | 'review' | 'neutral';

interface Mode {
  status: Record<ReportTone, string>;
  /** One hue, light → dark. Read in order; never cycled. */
  ordinal: string[];
  /** The single hue nominal bars wear, because bar length already carries value. */
  nominal: string;
  grid: string;
  axis: string;
  surface: string;
}

export const CHART_THEME: { light: Mode; dark: Mode } = {
  light: {
    status: {
      good: '#15803d',
      warning: '#f59e0b',
      critical: '#dc2626',
      review: '#7c3aed',
      // Grey on purpose: "no record" and "cancelled" are not failures.
      neutral: '#64748b',
    },
    ordinal: ['#4db8b6', '#148281', '#0d6362', '#0a4a49'],
    nominal: '#148281',
    grid: '#e2e8f0',
    axis: '#64748b',
    surface: '#ffffff',
  },
  dark: {
    status: {
      good: '#059669',
      warning: '#d97706',
      critical: '#e11d48',
      review: '#8b5cf6',
      neutral: '#8d9aa9',
    },
    ordinal: ['#c2e8e7', '#8ed4d2', '#4db8b6', '#148281'],
    nominal: '#4db8b6',
    grid: '#2a3440',
    axis: '#8d9aa9',
    surface: '#1b232d',
  },
};

/**
 * The colour for one slice.
 *
 * `status` reads the reserved scale by meaning. `ordinal` steps the single hue
 * by position, so the reader sees the sequence in the colour. `nominal` gives
 * every bar the same hue — colouring nominal bars by their value would spend the
 * identity channel re-encoding what the bar length already says.
 */
export function sliceColor(
  mode: Mode,
  encoding: 'status' | 'ordinal' | 'nominal',
  index: number,
  count: number,
  tone?: ReportTone
): string {
  if (encoding === 'status') return mode.status[tone ?? 'neutral'];
  if (encoding === 'ordinal') {
    if (count <= 1) return mode.ordinal[1];
    // Spread the available steps across however many stages there are, so a
    // three-stage chart still reads light → dark without inventing a step.
    const step = Math.round((index / (count - 1)) * (mode.ordinal.length - 1));
    return mode.ordinal[step];
  }
  return mode.nominal;
}

/** Icon key per status, so meaning survives without colour. */
export const TONE_ICON: Record<ReportTone, string> = {
  good: 'check',
  warning: 'clock',
  critical: 'alert',
  review: 'eye',
  neutral: 'minus',
};
