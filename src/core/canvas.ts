import type { DrawingCoord, Charset } from './types.js';
import { 
  getCharacterSet, 
  mergeJunctionChars, 
  isLineOrJunctionChar,
  connectsUp,
  connectsDown,
  connectsLeft,
  connectsRight,
  getJunctionChar,
  type CharacterSet 
} from './characters.js';

export class Canvas {
  private grid: string[][];
  private chars: CharacterSet;
  private occupied: boolean[][];
  
  constructor(
    private width: number,
    private height: number,
    charset: Charset = 'unicode'
  ) {
    this.grid = Array.from({ length: height }, () => 
      Array.from({ length: width }, () => ' ')
    );
    this.occupied = Array.from({ length: height }, () =>
      Array.from({ length: width }, () => false)
    );
    this.chars = getCharacterSet(charset);
  }

  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }

  set(x: number, y: number, char: string): void {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      if (this.occupied[y][x]) {
        return;
      }
      const existing = this.grid[y][x];
      if (isLineOrJunctionChar(existing) && isLineOrJunctionChar(char)) {
        this.grid[y][x] = mergeJunctionChars(existing, char);
      } else if (existing === ' ' || !isLineOrJunctionChar(existing)) {
        this.grid[y][x] = char;
      }
    }
  }

  forceSet(x: number, y: number, char: string): void {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.grid[y][x] = char;
    }
  }

  get(x: number, y: number): string {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      return this.grid[y][x];
    }
    return ' ';
  }

  drawText(x: number, y: number, text: string): void {
    for (let i = 0; i < text.length; i++) {
      if (x + i < this.width) {
        this.grid[y][x + i] = text[i];
      }
    }
  }

  drawHorizontalLine(x1: number, x2: number, y: number, char?: string): void {
    const lineChar = char ?? this.chars.line.horizontal;
    const startX = Math.min(x1, x2);
    const endX = Math.max(x1, x2);
    for (let x = startX; x <= endX; x++) {
      this.set(x, y, lineChar);
    }
  }

  drawVerticalLine(x: number, y1: number, y2: number, char?: string): void {
    const lineChar = char ?? this.chars.line.vertical;
    const startY = Math.min(y1, y2);
    const endY = Math.max(y1, y2);
    for (let y = startY; y <= endY; y++) {
      this.set(x, y, lineChar);
    }
  }

  drawBox(x: number, y: number, width: number, height: number): void {
    const { topLeft, topRight, bottomLeft, bottomRight, horizontal, vertical } = this.chars.box;
    
    this.set(x, y, topLeft);
    this.set(x + width - 1, y, topRight);
    this.set(x, y + height - 1, bottomLeft);
    this.set(x + width - 1, y + height - 1, bottomRight);
    
    for (let i = 1; i < width - 1; i++) {
      this.set(x + i, y, horizontal);
      this.set(x + i, y + height - 1, horizontal);
    }
    
    for (let i = 1; i < height - 1; i++) {
      this.set(x, y + i, vertical);
      this.set(x + width - 1, y + i, vertical);
    }
    
    this.markOccupied(x, y, width, height);
  }

  markOccupied(x: number, y: number, width: number, height: number): void {
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const px = x + dx;
        const py = y + dy;
        if (px >= 0 && px < this.width && py >= 0 && py < this.height) {
          this.occupied[py][px] = true;
        }
      }
    }
  }

  isOccupied(x: number, y: number): boolean {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return true;
    }
    return this.occupied[y][x];
  }

  isRegionClear(x: number, y: number, width: number, height: number): boolean {
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        if (this.isOccupied(x + dx, y + dy)) {
          return false;
        }
      }
    }
    return true;
  }

  drawArrow(x: number, y: number, direction: 'up' | 'down' | 'left' | 'right'): void {
    this.set(x, y, this.chars.arrow[direction]);
  }

  expandTo(newWidth: number, newHeight: number): void {
    if (newWidth > this.width) {
      for (let i = 0; i < this.grid.length; i++) {
        while (this.grid[i].length < newWidth) {
          this.grid[i].push(' ');
        }
        while (this.occupied[i].length < newWidth) {
          this.occupied[i].push(false);
        }
      }
      this.width = newWidth;
    }
    
    if (newHeight > this.height) {
      while (this.grid.length < newHeight) {
        this.grid.push(Array.from({ length: this.width }, () => ' '));
        this.occupied.push(Array.from({ length: this.width }, () => false));
      }
      this.height = newHeight;
    }
  }

  merge(other: Canvas, offsetX: number, offsetY: number): void {
    const requiredWidth = offsetX + other.getWidth();
    const requiredHeight = offsetY + other.getHeight();
    this.expandTo(requiredWidth, requiredHeight);
    
    for (let y = 0; y < other.getHeight(); y++) {
      for (let x = 0; x < other.getWidth(); x++) {
        const char = other.get(x, y);
        if (char !== ' ') {
          this.set(offsetX + x, offsetY + y, char);
        }
      }
    }
  }

  fixJunctions(): void {
    const junctionChars = '┼┬┴├┤+';
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const char = this.grid[y][x];
        if (!junctionChars.includes(char)) continue;
        
        const above = y > 0 ? this.grid[y - 1][x] : ' ';
        const below = y < this.height - 1 ? this.grid[y + 1][x] : ' ';
        const left = x > 0 ? this.grid[y][x - 1] : ' ';
        const right = x < this.width - 1 ? this.grid[y][x + 1] : ' ';
        
        const hasUp = connectsDown(above);
        const hasDown = connectsUp(below);
        const hasLeft = connectsRight(left);
        const hasRight = connectsLeft(right);
        
        const charset: Charset = this.chars === getCharacterSet('unicode') ? 'unicode' : 'ascii';
        const corrected = getJunctionChar(hasUp, hasDown, hasLeft, hasRight, charset);
        
        if (corrected !== char) {
          this.grid[y][x] = corrected;
        }
      }
    }
  }

  toString(): string {
    this.fixJunctions();
    return this.grid
      .map(row => row.join('').trimEnd())
      .join('\n')
      .trimEnd();
  }

  static fromCoord(coord: DrawingCoord): { x: number; y: number } {
    return { x: coord.x, y: coord.y };
  }
}
