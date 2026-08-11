// ── The colour of a year ─────────────────────────────────────────────────────
// One ordered ramp of the page's amber, oldest year lightest, newest darkest.
//
// It's a single hue getting darker rather than four different colours on
// purpose: the years are ordered, so the colour carries that order. Four
// unrelated hues would look livelier and say nothing — worse, it would imply
// the years are separate categories rather than one thing growing.
//
// The same colour is used for a year everywhere it appears — its row and its
// bar in the chart — so colour follows the year itself and not its position in
// whatever list is on screen.
//
// Validated as an ordinal ramp against the white card: lightness runs strictly
// light→dark, every step is clearly apart from the next, the lightest still
// stands off the card at 2.18:1, and the hue spread is 13°.
const RAMP = ["#e3a437", "#c8861f", "#a56814", "#7d4a0b"];

// `index` counts back from the newest year: 0 is this year, 1 is last year.
// Anything older than the ramp keeps the lightest step rather than wrapping
// round to a dark one and reading as recent.
export function yearColor(index: number, count: number): string {
  const fromOldest = Math.max(0, count - 1 - index);
  const step = Math.min(fromOldest, RAMP.length - 1);
  return RAMP[step];
}

// The same colour at low opacity, for a row's tinted background.
export function yearTint(index: number, count: number): string {
  return `${yearColor(index, count)}1f`; // ~12% alpha
}

// Ink that stays readable on top of the year's colour. White on the two lighter
// steps measures 2.18:1 and 3.05:1 — under the 4.5:1 needed for text this size,
// and it showed: the oldest year's label was the one hard thing to read on the
// page. Dark ink on those two is 7.23:1 and 5.17:1; white on the two darker
// steps is 4.58:1 and 7.35:1. So each step takes whichever passes.
const INK_ON: Record<string, string> = {
  "#e3a437": "#23231f",
  "#c8861f": "#23231f",
  "#a56814": "#ffffff",
  "#7d4a0b": "#ffffff",
};

export function yearInk(index: number, count: number): string {
  return INK_ON[yearColor(index, count)] ?? "#ffffff";
}
