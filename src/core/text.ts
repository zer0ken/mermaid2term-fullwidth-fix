const ELLIPSIS = '...';

export function truncateLabel(label: string, maxWidth: number): string {
  if (maxWidth <= 0 || label.length <= maxWidth) {
    return label;
  }
  
  if (maxWidth <= ELLIPSIS.length) {
    return label.slice(0, maxWidth);
  }
  
  return label.slice(0, maxWidth - ELLIPSIS.length) + ELLIPSIS;
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
