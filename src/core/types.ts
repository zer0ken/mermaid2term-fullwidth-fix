/**
 * Core type definitions for the mermaid2term library
 */

// ============================================================================
// Coordinate Systems
// ============================================================================

/**
 * Grid coordinate - logical positioning in the layout grid
 * Each node occupies a 3x3 grid cell (border + content + border)
 */
export interface GridCoord {
  x: number;
  y: number;
}

/**
 * Drawing coordinate - physical character position in the output canvas
 */
export interface DrawingCoord {
  x: number;
  y: number;
}

/**
 * Direction for graph layout and edge routing
 */
export type Direction = 'up' | 'down' | 'left' | 'right';

/**
 * Graph flow direction
 */
export type GraphDirection = 'LR' | 'RL' | 'TD' | 'BT';

// ============================================================================
// Node Types
// ============================================================================

/**
 * Shape types for flowchart nodes
 */
export type NodeShape = 
  | 'rect'        // [text] - Rectangle
  | 'round'       // (text) - Rounded rectangle / stadium
  | 'diamond'     // {text} - Diamond / decision
  | 'circle'      // ((text)) - Circle
  | 'asymmetric'  // >text] - Asymmetric / flag
  | 'hexagon'     // {{text}} - Hexagon
  | 'parallelogram' // [/text/] - Parallelogram
  | 'trapezoid'   // [/text\] - Trapezoid
  | 'cylinder'    // [(text)] - Cylinder / database
  | 'subroutine'; // [[text]] - Subroutine

export interface Node {
  id: string;
  label: string;
  /** Truncated label for display (set during layout if maxLabelWidth is used) */
  displayLabel?: string;
  shape: NodeShape;
  styleClass?: string;
  gridCoord?: GridCoord;
  drawingCoord?: DrawingCoord;
  width?: number;
  height?: number;
}

// ============================================================================
// Edge Types
// ============================================================================

/**
 * Arrow/line style for edges
 */
export type EdgeStyle = 'solid' | 'dotted' | 'thick';

/**
 * Arrow head type
 */
export type ArrowType = 
  | 'arrow'   // -->  Standard arrow
  | 'open'    // ---  No arrow head
  | 'circle'  // --o  Circle end
  | 'cross';  // --x  Cross end

/**
 * An edge connecting two nodes
 */
export interface Edge {
  /** Source node id */
  from: string;
  /** Target node id */
  to: string;
  /** Optional label on the edge */
  label?: string;
  /** Line style */
  style: EdgeStyle;
  /** Arrow head type at the target end */
  arrowType: ArrowType;
  /** Whether arrow points both ways */
  bidirectional: boolean;
  /** Calculated path through grid after layout */
  path?: GridCoord[];
  /** Starting direction from source node */
  startDirection?: Direction;
  /** Ending direction into target node */
  endDirection?: Direction;
}

// ============================================================================
// Style Types
// ============================================================================

/**
 * Style class definition (from classDef)
 */
export interface StyleClass {
  name: string;
  fill?: string;
  stroke?: string;
  color?: string;
  strokeWidth?: string;
}

// ============================================================================
// Render Options
// ============================================================================

/**
 * Character set to use for rendering
 */
export type Charset = 'unicode' | 'ascii';

/**
 * Options for rendering diagrams
 */
export interface RenderOptions {
  /** Character set - unicode for nice box drawing, ascii for compatibility */
  charset: Charset;
  /** Maximum output width in characters (0 = unlimited, -1 = auto-detect terminal) */
  maxWidth: number;
  /** Maximum label width before truncation (0 = unlimited) */
  maxLabelWidth: number;
  /** Horizontal spacing between nodes (in grid units) */
  paddingX: number;
  /** Vertical spacing between nodes (in grid units) */
  paddingY: number;
  /** Padding inside node borders */
  borderPadding: number;
  /** Show debug coordinates overlay */
  showCoords: boolean;
  /** Compact mode - minimal spacing for space-constrained terminals */
  compact: boolean;
}

/**
 * Default render options
 */
export const DEFAULT_RENDER_OPTIONS: RenderOptions = {
  charset: 'unicode',
  maxWidth: 0,
  maxLabelWidth: 0,
  paddingX: 2,
  paddingY: 1,
  borderPadding: 1,
  showCoords: false,
  compact: false,
};

/**
 * Compact mode overrides for space-constrained rendering
 */
export const COMPACT_MODE_OVERRIDES: Partial<RenderOptions> = {
  paddingX: 1,
  paddingY: 0,
  borderPadding: 0,
};

// ============================================================================
// Diagram Types
// ============================================================================

/**
 * Supported diagram types
 */
export type DiagramType = 'flowchart' | 'sequence' | 'class' | 'state' | 'er' | 'unknown';

/**
 * Base interface for all diagram ASTs
 */
export interface BaseDiagramAST {
  type: DiagramType;
}

/**
 * Result of layout computation
 */
export interface LayoutResult {
  /** Total width needed */
  width: number;
  /** Total height needed */
  height: number;
  /** Positioned nodes */
  nodes: Node[];
  /** Routed edges */
  edges: Edge[];
  /** Column widths (grid coord -> char width) */
  columnWidths: Map<number, number>;
  /** Row heights (grid coord -> char height) */
  rowHeights: Map<number, number>;
}

// ============================================================================
// Diagram Renderer Interface
// ============================================================================

/**
 * Interface that all diagram type renderers must implement
 */
export interface DiagramRenderer<T extends BaseDiagramAST = BaseDiagramAST> {
  /** Parse input string into diagram AST */
  parse(input: string): T;
  
  /** Compute layout positions for all elements */
  layout(ast: T, options: RenderOptions): LayoutResult;
  
  /** Render laid-out diagram to ASCII string */
  render(layout: LayoutResult, options: RenderOptions): string;
}
