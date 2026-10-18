const ELLIPSIS = '...';

/**
 * Whether a single character renders as full-width (East Asian Wide / Fullwidth).
 * Full-width glyphs (Korean, Chinese, Japanese, fullwidth forms) occupy two terminal
 * columns in a monospace terminal, while the JS `string.length` counts them as one.
 */
export function isFullWidth(char: string): boolean {
  const code = char.codePointAt(0);
  if (code === undefined) {
    return false;
  }
  return (
    (code >= 0x1100 && code <= 0x115f) || // Hangul Jamo
    (code >= 0x2e80 && code <= 0x303e) || // CJK Radicals, Kangxi, CJK Symbols
    (code >= 0x3041 && code <= 0x33ff) || // Hiragana, Katakana, CJK Compat
    (code >= 0x3400 && code <= 0x4dbf) || // CJK Ext A
    (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified Ideographs
    (code >= 0xa000 && code <= 0xa4cf) || // Yi
    (code >= 0xac00 && code <= 0xd7a3) || // Hangul Syllables
    (code >= 0xf900 && code <= 0xfaff) || // CJK Compat Ideographs
    (code >= 0xfe30 && code <= 0xfe4f) || // CJK Compat Forms
    (code >= 0xff00 && code <= 0xff60) || // Fullwidth forms
    (code >= 0xffe0 && code <= 0xffe6) || // Fullwidth signs
    (code >= 0x20000 && code <= 0x2fffd) || // CJK Ext B+
    (code >= 0x30000 && code <= 0x3fffd)
  );
}

/**
 * The number of terminal columns a string occupies, counting full-width characters
 * as two columns and everything else as one.
 */
export function displayWidth(text: string): number {
  let width = 0;
  for (const char of text) {
    width += isFullWidth(char) ? 2 : 1;
  }
  return width;
}

export function truncateLabel(label: string, maxWidth: number): string {
  if (maxWidth <= 0 || displayWidth(label) <= maxWidth) {
    return label;
  }

  if (maxWidth <= ELLIPSIS.length) {
    return label.slice(0, maxWidth);
  }

  let width = 0;
  let cut = 0;
  for (const char of label) {
    const w = isFullWidth(char) ? 2 : 1;
    if (width + w > maxWidth - ELLIPSIS.length) {
      break;
    }
    width += w;
    cut += char.length;
  }
  return label.slice(0, cut) + ELLIPSIS;
}

export function getTerminalWidth(): number {
  if (typeof process !== 'undefined' && process.stdout?.columns) {
    return process.stdout.columns;
  }
  return 80;
}

export function isInteractiveTerminal(): boolean {
  return typeof process !== 'undefined' && 
         process.stdout?.isTTY === true;
}
