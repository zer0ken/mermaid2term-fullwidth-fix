import type { BaseDiagramAST, GraphDirection, Node, Edge, StyleClass } from '../../core/types.js';

export interface FlowchartNode extends Node {
  index: number;
}

export interface FlowchartEdge extends Edge {
  index: number;
}

export interface Subgraph {
  id: string;
  label: string;
  nodeIds: string[];
}

export interface FlowchartAST extends BaseDiagramAST {
  type: 'flowchart';
  direction: GraphDirection;
  nodes: Map<string, FlowchartNode>;
  edges: FlowchartEdge[];
  subgraphs: Subgraph[];
  styleClasses: Map<string, StyleClass>;
}
