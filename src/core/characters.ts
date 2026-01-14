import type { Charset } from './types.js';

export interface BoxChars {
  topLeft: string;
  topRight: string;
  bottomLeft: string;
  bottomRight: string;
  horizontal: string;
  vertical: string;
}

export interface LineChars {
  horizontal: string;
  vertical: string;
  dottedHorizontal: string;
  dottedVertical: string;
  thickHorizontal: string;
  thickVertical: string;
}

export interface ArrowChars {
  up: string;
  down: string;
  left: string;
  right: string;
  upOpen: string;
  downOpen: string;
  leftOpen: string;
  rightOpen: string;
  circle: string;
  cross: string;
}

export interface JunctionChars {
  cross: string;
  leftT: string;
  rightT: string;
  topT: string;
  bottomT: string;
}

export interface CharacterSet {
  box: BoxChars;
  line: LineChars;
  arrow: ArrowChars;
  junction: JunctionChars;
}

const UNICODE_CHARS: CharacterSet = {
  box: {
    topLeft: '┌',
    topRight: '┐',
    bottomLeft: '└',
    bottomRight: '┘',
    horizontal: '─',
    vertical: '│',
  },
  line: {
    horizontal: '─',
    vertical: '│',
    dottedHorizontal: '┈',
    dottedVertical: '┊',
    thickHorizontal: '━',
    thickVertical: '┃',
  },
  arrow: {
    up: '▲',
    down: '▼',
    left: '◄',
    right: '►',
    upOpen: '△',
    downOpen: '▽',
    leftOpen: '◁',
    rightOpen: '▷',
    circle: '●',
    cross: '×',
  },
  junction: {
    cross: '┼',
    leftT: '├',
    rightT: '┤',
    topT: '┬',
    bottomT: '┴',
  },
};

const ASCII_CHARS: CharacterSet = {
  box: {
    topLeft: '+',
    topRight: '+',
    bottomLeft: '+',
    bottomRight: '+',
    horizontal: '-',
    vertical: '|',
  },
  line: {
    horizontal: '-',
    vertical: '|',
    dottedHorizontal: '.',
    dottedVertical: ':',
    thickHorizontal: '=',
    thickVertical: '#',
  },
  arrow: {
    up: '^',
    down: 'v',
    left: '<',
    right: '>',
    upOpen: '^',
    downOpen: 'v',
    leftOpen: '<',
    rightOpen: '>',
    circle: 'o',
    cross: 'x',
  },
  junction: {
    cross: '+',
    leftT: '+',
    rightT: '+',
    topT: '+',
    bottomT: '+',
  },
};

export function getCharacterSet(charset: Charset): CharacterSet {
  return charset === 'unicode' ? UNICODE_CHARS : ASCII_CHARS;
}

const JUNCTION_MERGE_MAP: Record<string, Record<string, string>> = {
  '─': { '│': '┼', '┌': '┬', '┐': '┬', '└': '┴', '┘': '┴', '├': '┼', '┤': '┼', '┬': '┬', '┴': '┴' },
  '│': { '─': '┼', '┌': '├', '┐': '┤', '└': '├', '┘': '┤', '┬': '┼', '┴': '┼', '├': '├', '┤': '┤' },
  '┌': { '─': '┬', '│': '├', '┘': '┼', '┐': '┬', '└': '├' },
  '┐': { '─': '┬', '│': '┤', '└': '┼', '┌': '┬', '┘': '┤' },
  '└': { '─': '┴', '│': '├', '┐': '┼', '┌': '├', '┘': '┴' },
  '┘': { '─': '┴', '│': '┤', '┌': '┼', '└': '┴', '┐': '┤' },
  '├': { '─': '┼', '┤': '┼', '┬': '┼', '┴': '┼' },
  '┤': { '─': '┼', '├': '┼', '┬': '┼', '┴': '┼' },
  '┬': { '│': '┼', '├': '┼', '┤': '┼', '┴': '┼' },
  '┴': { '│': '┼', '├': '┼', '┤': '┼', '┬': '┼' },
};

export function mergeJunctionChars(existing: string, incoming: string): string {
  if (existing === ' ') return incoming;
  if (incoming === ' ') return existing;
  if (existing === incoming) return existing;
  
  const merged = JUNCTION_MERGE_MAP[existing]?.[incoming];
  if (merged) return merged;
  
  const reverseMerged = JUNCTION_MERGE_MAP[incoming]?.[existing];
  if (reverseMerged) return reverseMerged;
  
  return incoming;
}

export function isLineOrJunctionChar(char: string): boolean {
  return '─│├┤┬┴┼┈┊━┃-|+'.includes(char);
}

export function isJunctionChar(char: string): boolean {
  return '─│┌┐└┘├┤┬┴┼┈┊━┃-|+'.includes(char);
}

export function isHorizontalChar(char: string): boolean {
  return '─┈━-═'.includes(char);
}

export function isVerticalChar(char: string): boolean {
  return '│┊┃|║'.includes(char);
}

export function connectsLeft(char: string): boolean {
  return '─┈━-═┼┴┬┤┘┐├└┌+◄<◁'.includes(char);
}

export function connectsRight(char: string): boolean {
  return '─┈━-═┼┴┬├┘┐┤└┌+►>▷'.includes(char);
}

export function connectsUp(char: string): boolean {
  return '│┊┃|║┼├┤┴┘└+▲^△'.includes(char);
}

export function connectsDown(char: string): boolean {
  return '│┊┃|║┼├┤┬┐┌+▼v▽'.includes(char);
}

export function getJunctionChar(
  up: boolean,
  down: boolean, 
  left: boolean,
  right: boolean,
  charset: Charset
): string {
  const chars = getCharacterSet(charset);
  const count = [up, down, left, right].filter(Boolean).length;
  
  if (count === 4) return chars.junction.cross;
  if (count === 3) {
    if (!up) return chars.junction.topT;
    if (!down) return chars.junction.bottomT;
    if (!left) return chars.junction.leftT;
    if (!right) return chars.junction.rightT;
  }
  if (count === 2) {
    if (up && down) return chars.line.vertical;
    if (left && right) return chars.line.horizontal;
    if (down && right) return chars.box.topLeft;
    if (down && left) return chars.box.topRight;
    if (up && right) return chars.box.bottomLeft;
    if (up && left) return chars.box.bottomRight;
  }
  if (count === 1) {
    if (up || down) return chars.line.vertical;
    if (left || right) return chars.line.horizontal;
  }
  return ' ';
}
