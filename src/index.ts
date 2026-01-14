import type { RenderOptions, DiagramType } from './core/types.js';
import { DEFAULT_RENDER_OPTIONS } from './core/types.js';
import { parseFlowchart } from './diagrams/flowchart/parser.js';
import { renderFlowchart } from './diagrams/flowchart/renderer.js';
import { parseSequence } from './diagrams/sequence/parser.js';
import { renderSequence } from './diagrams/sequence/renderer.js';

export * from './core/types.js';
export * from './core/canvas.js';
export * from './core/characters.js';
export * from './diagrams/flowchart/index.js';
export * from './diagrams/sequence/index.js';

const FLOWCHART_PATTERN = /^(?:graph|flowchart)\s+(LR|RL|TD|TB|BT)/im;
const SEQUENCE_PATTERN = /^sequenceDiagram/im;
const CLASS_PATTERN = /^classDiagram/im;
const STATE_PATTERN = /^stateDiagram/im;
const ER_PATTERN = /^erDiagram/im;

export function detectDiagramType(input: string): DiagramType {
  const trimmed = input.trim();
  
  if (FLOWCHART_PATTERN.test(trimmed)) return 'flowchart';
  if (SEQUENCE_PATTERN.test(trimmed)) return 'sequence';
  if (CLASS_PATTERN.test(trimmed)) return 'class';
  if (STATE_PATTERN.test(trimmed)) return 'state';
  if (ER_PATTERN.test(trimmed)) return 'er';
  
  return 'unknown';
}

export function render(
  input: string,
  options: Partial<RenderOptions> = {}
): string {
  const fullOptions: RenderOptions = { ...DEFAULT_RENDER_OPTIONS, ...options };
  const diagramType = detectDiagramType(input);
  
  switch (diagramType) {
    case 'flowchart': {
      const ast = parseFlowchart(input);
      return renderFlowchart(ast, fullOptions);
    }
    case 'sequence': {
      const ast = parseSequence(input);
      return renderSequence(ast, fullOptions);
    }
    case 'class':
      throw new Error('Class diagrams not yet implemented');
    case 'state':
      throw new Error('State diagrams not yet implemented');
    case 'er':
      throw new Error('ER diagrams not yet implemented');
    case 'unknown':
      throw new Error(`Unknown diagram type. Input must start with a valid Mermaid diagram declaration (e.g., "graph LR", "sequenceDiagram", etc.)`);
  }
}

export function renderToFlowchart(
  input: string,
  options: Partial<RenderOptions> = {}
): string {
  const fullOptions: RenderOptions = { ...DEFAULT_RENDER_OPTIONS, ...options };
  const ast = parseFlowchart(input);
  return renderFlowchart(ast, fullOptions);
}

export function renderToSequence(
  input: string,
  options: Partial<RenderOptions> = {}
): string {
  const fullOptions: RenderOptions = { ...DEFAULT_RENDER_OPTIONS, ...options };
  const ast = parseSequence(input);
  return renderSequence(ast, fullOptions);
}
