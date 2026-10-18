import { describe, expect, it } from 'vitest';
import { displayWidth, isFullWidth } from './text.js';
import { render } from '../index.js';

describe('displayWidth', () => {
  it('counts ASCII characters as one column each', () => {
    expect(displayWidth('')).toBe(0);
    expect(displayWidth('abc')).toBe(3);
    expect(displayWidth('V22 1.1s')).toBe(8);
  });

  it('counts full-width (CJK) characters as two columns each', () => {
    expect(displayWidth('한')).toBe(2);
    expect(displayWidth('한글')).toBe(4);
    expect(displayWidth('한글테스트문장')).toBe(14);
  });

  it('counts mixed half-width and full-width text correctly', () => {
    expect(displayWidth('V22 1차 추출')).toBe(12);
    expect(displayWidth('한a글b')).toBe(6);
  });
});

describe('isFullWidth', () => {
  it('flags Hangul, CJK, Hiragana, and Katakana', () => {
    expect(isFullWidth('한')).toBe(true);
    expect(isFullWidth('中')).toBe(true);
    expect(isFullWidth('あ')).toBe(true);
    expect(isFullWidth('ア')).toBe(true);
  });

  it('does not flag ASCII or common punctuation', () => {
    expect(isFullWidth('a')).toBe(false);
    expect(isFullWidth(' ')).toBe(false);
    expect(isFullWidth('1')).toBe(false);
    expect(isFullWidth('.')).toBe(false);
  });
});

describe('full-width label rendering', () => {
  it('keeps Korean text inside its box borders', () => {
    const out = render(`flowchart LR\n    A[한글테스트문장] --> B[결과 출력]\n`);
    const lines = out.split('\n');
    const textLine = lines.find((l) => l.includes('한글테스트문장'));
    expect(textLine).toBeTruthy();
    // The text must be flanked by box borders on both sides (no overflow).
    expect(textLine!.trim().startsWith('│ 한글테스트문장 │')).toBe(true);
    expect(textLine!.trim().endsWith('│')).toBe(true);
  });

  it('sizes a box to fit its full-width label width', () => {
    const out = render(`flowchart LR\n    A[한글] --> B[중복병합]\n`);
    const topLine = out
      .split('\n')
      .find((l) => l.includes('┌'));
    expect(topLine).toBeTruthy();
    // 한글 is 4 columns wide, so the top border must have at least 4 dashes.
    const dashRun = topLine!.match(/─+/);
    expect(dashRun).toBeTruthy();
    expect(dashRun![0].length).toBeGreaterThanOrEqual(4);
  });
});
