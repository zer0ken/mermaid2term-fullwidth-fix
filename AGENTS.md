# AGENTS.md - mermaid2term

> TypeScript library and CLI for rendering Mermaid diagrams as ASCII/Unicode art in the terminal.

## Quick Reference

```bash
# Install dependencies
npm install

# Build (tsup)
npm run build

# Run tests
npm test                    # Watch mode
npm run test:run            # Single run

# Run single test file
npx vitest run src/parser.test.ts
npx vitest run --grep "test name pattern"

# Development
npm run dev                 # Watch mode build

# Type checking
npm run typecheck           # tsc --noEmit

# Lint (if ESLint configured)
npm run lint
```

## Architecture Overview

```
src/
├── index.ts              # Public API entry point
├── cli.ts                # Commander-based CLI
├── core/
│   ├── types.ts          # Core type definitions (RenderOptions, Node, Edge, etc.)
│   ├── canvas.ts         # Canvas class for 2D character grid rendering
│   └── characters.ts     # Unicode/ASCII character sets for box drawing
├── diagrams/
│   ├── flowchart/
│   │   ├── parser.ts     # Mermaid flowchart syntax parser
│   │   ├── renderer.ts   # Flowchart-to-ASCII renderer
│   │   └── types.ts      # Flowchart-specific types
│   └── sequence/
│       ├── parser.ts     # Sequence diagram parser
│       ├── renderer.ts   # Sequence diagram renderer
│       └── types.ts      # Sequence-specific types
└── layout/
    ├── sugiyama.ts       # Sugiyama layered graph layout algorithm
    └── pathfinding.ts    # Edge routing utilities
```

## TypeScript Configuration

**Target**: ES2022, ESNext modules, Node 18+  
**Strict Mode**: Enabled with additional checks

Key compiler options:
- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noImplicitReturns: true`
- `noFallthroughCasesInSwitch: true`

## Code Style Guidelines

### Imports

```typescript
// Type imports use 'import type' syntax
import type { RenderOptions, Direction } from './core/types.js';

// Value imports are separate
import { Canvas } from './core/canvas.js';
import { getCharacterSet } from './core/characters.js';

// Always use .js extension (ESM requirement)
import { parseFlowchart } from './diagrams/flowchart/parser.js';
```

### Type Definitions

```typescript
// Use 'type' for unions and simple aliases
export type NodeShape = 'rect' | 'round' | 'diamond' | 'circle';
export type Direction = 'up' | 'down' | 'left' | 'right';

// Use 'interface' for object shapes
export interface Node {
  id: string;
  label: string;
  shape: NodeShape;
  gridCoord?: GridCoord;      // Optional properties with ?
  width?: number;
}

// Document interfaces with JSDoc when non-obvious
/**
 * Grid coordinate - logical positioning in the layout grid
 * Each node occupies a 3x3 grid cell (border + content + border)
 */
export interface GridCoord {
  x: number;
  y: number;
}
```

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Types/Interfaces | PascalCase | `FlowchartNode`, `RenderOptions` |
| Functions | camelCase | `parseFlowchart`, `getCharacterSet` |
| Constants | SCREAMING_SNAKE_CASE | `DEFAULT_RENDER_OPTIONS`, `UNICODE_CHARS` |
| Local variables | camelCase | `nodeId`, `layerNodes` |
| Private class members | camelCase (no prefix) | `this.grid`, `this.chars` |
| Boolean variables | `is`/`has` prefix | `isHorizontal`, `hasUp` |

### Function Patterns

```typescript
// Pure functions preferred - take input, return output
export function parseFlowchart(input: string): FlowchartAST {
  // ...
}

// Options parameters use Partial<T> with defaults
export function render(
  input: string,
  options: Partial<RenderOptions> = {}
): string {
  const fullOptions: RenderOptions = { ...DEFAULT_RENDER_OPTIONS, ...options };
  // ...
}

// Internal functions are non-exported, at module level
function getOutgoingEdges(nodeId: string, edges: FlowchartEdge[]): FlowchartEdge[] {
  return edges.filter(e => e.from === nodeId);
}
```

### Error Handling

```typescript
// Throw descriptive Error objects
if (lines.length === 0) {
  throw new Error('Empty flowchart input');
}

if (!directionMatch) {
  throw new Error(`Invalid flowchart header. Expected "graph LR|RL|TD|TB|BT", got: "${lines[0]}"`);
}

// CLI wraps errors gracefully
try {
  const output = render(input, options);
  console.log(output);
} catch (error) {
  if (error instanceof Error) {
    console.error(`Error: ${error.message}`);
  } else {
    console.error('An unknown error occurred');
  }
  process.exit(1);
}
```

### Classes

```typescript
// Classes use private members, expose via methods
export class Canvas {
  private grid: string[][];
  private chars: CharacterSet;
  
  constructor(
    private width: number,      // Parameter properties
    private height: number,
    charset: Charset = 'unicode'
  ) {
    this.grid = Array.from({ length: height }, () => 
      Array.from({ length: width }, () => ' ')
    );
    this.chars = getCharacterSet(charset);
  }

  // Public methods are verbs
  set(x: number, y: number, char: string): void { /* ... */ }
  get(x: number, y: number): string { /* ... */ }
  drawBox(x: number, y: number, width: number, height: number): void { /* ... */ }
  toString(): string { /* ... */ }
}
```

### Pattern: Regex Definitions

```typescript
// Regex patterns as module-level constants
const DIRECTION_PATTERN = /^(?:graph|flowchart)\s+(LR|RL|TD|TB|BT)\s*$/i;
const CLASSDEF_PATTERN = /^classDef\s+(\w+)\s+(.+)$/;

// Pattern arrays for matching multiple shapes
const NODE_DEF_PATTERNS: Array<{ pattern: RegExp; shape: NodeShape }> = [
  { pattern: /^(\w+)\[\[(.+)\]\]$/, shape: 'subroutine' },
  { pattern: /^(\w+)\{(.+)\}$/, shape: 'diamond' },
  { pattern: /^(\w+)\[(.+)\]$/, shape: 'rect' },
  { pattern: /^(\w+)$/, shape: 'rect' },  // Fallback last
];
```

### Data Structures

```typescript
// Use Map<K, V> for dynamic key-value storage
const nodes = new Map<string, FlowchartNode>();
const columnWidths = new Map<number, number>();

// Use Set<T> for unique collections
const backEdges = new Set<FlowchartEdge>();
const visited = new Set<string>();

// Return interfaces for complex results
interface LayoutedGraph {
  nodes: Map<string, FlowchartNode>;
  edges: FlowchartEdge[];
  backEdges: Set<FlowchartEdge>;
  width: number;
  height: number;
}
```

## Testing Guidelines

Tests use Vitest. No test files exist yet - when adding:

```typescript
// src/diagrams/flowchart/parser.test.ts
import { describe, it, expect } from 'vitest';
import { parseFlowchart } from './parser.js';

describe('parseFlowchart', () => {
  it('parses simple LR flowchart', () => {
    const ast = parseFlowchart('graph LR\n  A --> B');
    expect(ast.direction).toBe('LR');
    expect(ast.nodes.size).toBe(2);
  });

  it('throws on invalid header', () => {
    expect(() => parseFlowchart('invalid')).toThrow('Invalid flowchart header');
  });
});
```

## Build System (tsup)

- Dual output: ESM (`.js`) and CJS (`.cjs`)
- TypeScript declarations (`.d.ts`)
- Source maps enabled
- No minification (library code)
- Target: Node 18

## Key Domain Concepts

1. **Grid Coordinates**: Logical node positions in layout algorithm
2. **Drawing Coordinates**: Physical character positions on canvas
3. **Sugiyama Layout**: Layered graph drawing algorithm for flowcharts
4. **Back Edges**: Cycle-forming edges, routed around nodes
5. **Character Sets**: Unicode (crisp) vs ASCII (compatible) rendering

## Common Tasks

### Adding a new diagram type

1. Create `src/diagrams/<type>/types.ts` with AST definition
2. Create `src/diagrams/<type>/parser.ts` with parser function
3. Create `src/diagrams/<type>/renderer.ts` with render function
4. Add detection pattern and case in `src/index.ts`

### Modifying box drawing

Character definitions in `src/core/characters.ts`. Canvas drawing logic in `src/core/canvas.ts`.
