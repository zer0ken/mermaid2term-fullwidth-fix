import type { GraphDirection, GridCoord, RenderOptions } from '../core/types.js';
import type { FlowchartNode, FlowchartEdge, FlowchartAST } from '../diagrams/flowchart/types.js';
import { truncateLabel } from '../core/text.js';

export interface LayoutedGraph {
  nodes: Map<string, FlowchartNode>;
  edges: FlowchartEdge[];
  backEdges: Set<FlowchartEdge>;
  width: number;
  height: number;
  columnWidths: Map<number, number>;
  rowHeights: Map<number, number>;
}

function getOutgoingEdges(nodeId: string, edges: FlowchartEdge[]): FlowchartEdge[] {
  return edges.filter(e => e.from === nodeId);
}

function getIncomingEdges(nodeId: string, edges: FlowchartEdge[]): FlowchartEdge[] {
  return edges.filter(e => e.to === nodeId);
}

function detectCyclesAndBackEdges(
  nodes: Map<string, FlowchartNode>,
  edges: FlowchartEdge[]
): { backEdges: Set<FlowchartEdge>; forwardEdges: FlowchartEdge[] } {
  const backEdges = new Set<FlowchartEdge>();
  const visited = new Set<string>();
  const inStack = new Set<string>();
  
  function dfs(nodeId: string): void {
    visited.add(nodeId);
    inStack.add(nodeId);
    
    for (const edge of getOutgoingEdges(nodeId, edges)) {
      if (inStack.has(edge.to)) {
        backEdges.add(edge);
      } else if (!visited.has(edge.to)) {
        dfs(edge.to);
      }
    }
    
    inStack.delete(nodeId);
  }
  
  for (const nodeId of nodes.keys()) {
    if (!visited.has(nodeId)) {
      dfs(nodeId);
    }
  }
  
  const forwardEdges = edges.filter(e => !backEdges.has(e));
  return { backEdges, forwardEdges };
}

function assignLayers(
  nodes: Map<string, FlowchartNode>,
  forwardEdges: FlowchartEdge[]
): Map<string, number> {
  const layers = new Map<string, number>();
  const inDegree = new Map<string, number>();
  
  for (const nodeId of nodes.keys()) {
    inDegree.set(nodeId, 0);
  }
  
  for (const edge of forwardEdges) {
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
  }
  
  const queue: string[] = [];
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) {
      queue.push(nodeId);
      layers.set(nodeId, 0);
    }
  }
  
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    const currentLayer = layers.get(nodeId) ?? 0;
    
    for (const edge of getOutgoingEdges(nodeId, forwardEdges)) {
      const targetLayer = Math.max(layers.get(edge.to) ?? 0, currentLayer + 1);
      layers.set(edge.to, targetLayer);
      
      const newDegree = (inDegree.get(edge.to) ?? 1) - 1;
      inDegree.set(edge.to, newDegree);
      
      if (newDegree === 0) {
        queue.push(edge.to);
      }
    }
  }
  
  for (const nodeId of nodes.keys()) {
    if (!layers.has(nodeId)) {
      layers.set(nodeId, 0);
    }
  }
  
  return layers;
}

function orderNodesInLayers(
  nodes: Map<string, FlowchartNode>,
  edges: FlowchartEdge[],
  layers: Map<string, number>,
  backEdges: Set<FlowchartEdge>
): Map<number, string[]> {
  const layerNodes = new Map<number, string[]>();
  
  for (const [nodeId, layer] of layers) {
    if (!layerNodes.has(layer)) {
      layerNodes.set(layer, []);
    }
    layerNodes.get(layer)!.push(nodeId);
  }
  
  const forwardEdges = edges.filter(e => !backEdges.has(e));
  
  for (let iteration = 0; iteration < 4; iteration++) {
    const sortedLayers = [...layerNodes.keys()].sort((a, b) => a - b);
    
    for (const layer of sortedLayers) {
      if (layer === 0) {
        const nodeIds = layerNodes.get(layer)!;
        nodeIds.sort((a, b) => (nodes.get(a)?.index ?? 0) - (nodes.get(b)?.index ?? 0));
        continue;
      }
      
      const nodeIds = layerNodes.get(layer)!;
      const prevLayerNodes = layerNodes.get(layer - 1) ?? [];
      const prevPositions = new Map(prevLayerNodes.map((id, idx) => [id, idx]));
      
      nodeIds.sort((a, b) => {
        const aIncoming = getIncomingEdges(a, forwardEdges);
        const bIncoming = getIncomingEdges(b, forwardEdges);
        
        const aBarycenter = aIncoming.length > 0
          ? aIncoming.reduce((sum, e) => sum + (prevPositions.get(e.from) ?? 0), 0) / aIncoming.length
          : nodes.get(a)?.index ?? 0;
        const bBarycenter = bIncoming.length > 0
          ? bIncoming.reduce((sum, e) => sum + (prevPositions.get(e.from) ?? 0), 0) / bIncoming.length
          : nodes.get(b)?.index ?? 0;
        
        return aBarycenter - bBarycenter;
      });
    }
  }
  
  return layerNodes;
}

function assignGridCoordinates(
  nodes: Map<string, FlowchartNode>,
  layerNodes: Map<number, string[]>,
  direction: GraphDirection,
  _options: RenderOptions
): void {
  const isHorizontal = direction === 'LR' || direction === 'RL';
  const isReversed = direction === 'RL' || direction === 'BT';
  const spacing = 1;
  
  const maxLayer = Math.max(...layerNodes.keys(), 0);
  
  for (const [layer, nodeIds] of layerNodes) {
    const actualLayer = isReversed ? maxLayer - layer : layer;
    
    for (let pos = 0; pos < nodeIds.length; pos++) {
      const nodeId = nodeIds[pos];
      const node = nodes.get(nodeId);
      if (!node) continue;
      
      if (isHorizontal) {
        node.gridCoord = {
          x: actualLayer * spacing,
          y: pos * spacing,
        };
      } else {
        node.gridCoord = {
          x: pos * spacing,
          y: actualLayer * spacing,
        };
      }
    }
  }
}

function calculateDimensions(
  nodes: Map<string, FlowchartNode>,
  options: RenderOptions
): { columnWidths: Map<number, number>; rowHeights: Map<number, number> } {
  const columnWidths = new Map<number, number>();
  const rowHeights = new Map<number, number>();
  
  for (const node of nodes.values()) {
    if (!node.gridCoord) continue;
    
    const displayLabel = options.maxLabelWidth > 0
      ? truncateLabel(node.label, options.maxLabelWidth)
      : node.label;
    
    node.displayLabel = displayLabel;
    
    const labelWidth = displayLabel.length + options.borderPadding * 2 + 2;
    const labelHeight = 1 + options.borderPadding * 2 + 2;
    
    node.width = labelWidth;
    node.height = labelHeight;
    
    const col = node.gridCoord.x;
    const row = node.gridCoord.y;
    
    const currentColWidth = columnWidths.get(col) ?? 0;
    columnWidths.set(col, Math.max(currentColWidth, labelWidth));
    
    const currentRowHeight = rowHeights.get(row) ?? 0;
    rowHeights.set(row, Math.max(currentRowHeight, labelHeight));
  }
  
  const maxCol = columnWidths.size > 0 ? Math.max(...columnWidths.keys()) : 0;
  const maxRow = rowHeights.size > 0 ? Math.max(...rowHeights.keys()) : 0;
  
  for (let i = 0; i <= maxCol; i++) {
    if (!columnWidths.has(i)) {
      columnWidths.set(i, options.paddingX);
    }
  }
  
  for (let i = 0; i <= maxRow; i++) {
    if (!rowHeights.has(i)) {
      rowHeights.set(i, options.paddingY);
    }
  }
  
  return { columnWidths, rowHeights };
}

function gridToDrawingCoord(
  gridCoord: GridCoord,
  columnWidths: Map<number, number>,
  rowHeights: Map<number, number>,
  paddingX: number,
  paddingY: number
): { x: number; y: number } {
  let x = 0;
  for (let col = 0; col < gridCoord.x; col++) {
    x += (columnWidths.get(col) ?? 0) + paddingX;
  }
  
  let y = 0;
  for (let row = 0; row < gridCoord.y; row++) {
    y += (rowHeights.get(row) ?? 0) + paddingY;
  }
  
  return { x, y };
}

function calculateTotalWidth(columnWidths: Map<number, number>, paddingX: number): number {
  let total = 0;
  for (const width of columnWidths.values()) {
    total += width + paddingX;
  }
  return total;
}

function calculateTotalHeight(rowHeights: Map<number, number>, paddingY: number): number {
  let total = 0;
  for (const height of rowHeights.values()) {
    total += height + paddingY;
  }
  return total;
}

function findMaxLabelWidthToFit(
  nodes: Map<string, FlowchartNode>,
  options: RenderOptions,
  targetWidth: number
): number {
  const nodeCount = nodes.size;
  if (nodeCount === 0) return 0;
  
  const numColumns = new Set([...nodes.values()].map(n => n.gridCoord?.x ?? 0)).size;
  const overheadPerNode = options.borderPadding * 2 + 2;
  const totalPadding = numColumns * options.paddingX;
  const availableForLabels = targetWidth - totalPadding - (numColumns * overheadPerNode);
  
  const maxLabelWidth = Math.max(3, Math.floor(availableForLabels / numColumns));
  return maxLabelWidth;
}

export function layoutFlowchart(
  ast: FlowchartAST,
  options: RenderOptions
): LayoutedGraph {
  const { nodes, edges, direction } = ast;
  
  if (nodes.size === 0) {
    return {
      nodes,
      edges,
      backEdges: new Set(),
      width: 0,
      height: 0,
      columnWidths: new Map(),
      rowHeights: new Map(),
    };
  }
  
  const { backEdges, forwardEdges } = detectCyclesAndBackEdges(nodes, edges);
  const layers = assignLayers(nodes, forwardEdges);
  const layerNodes = orderNodesInLayers(nodes, edges, layers, backEdges);
  assignGridCoordinates(nodes, layerNodes, direction, options);
  
  let effectiveOptions = options;
  let { columnWidths, rowHeights } = calculateDimensions(nodes, effectiveOptions);
  let totalWidth = calculateTotalWidth(columnWidths, effectiveOptions.paddingX);
  
  if (options.maxWidth > 0 && totalWidth > options.maxWidth) {
    const calculatedMaxLabel = findMaxLabelWidthToFit(nodes, options, options.maxWidth);
    
    if (calculatedMaxLabel > 0) {
      effectiveOptions = {
        ...options,
        maxLabelWidth: options.maxLabelWidth > 0
          ? Math.min(options.maxLabelWidth, calculatedMaxLabel)
          : calculatedMaxLabel,
      };
      
      const recalculated = calculateDimensions(nodes, effectiveOptions);
      columnWidths = recalculated.columnWidths;
      rowHeights = recalculated.rowHeights;
      totalWidth = calculateTotalWidth(columnWidths, effectiveOptions.paddingX);
    }
  }
  
  for (const node of nodes.values()) {
    if (node.gridCoord) {
      const baseCoord = gridToDrawingCoord(
        node.gridCoord,
        columnWidths,
        rowHeights,
        effectiveOptions.paddingX,
        effectiveOptions.paddingY
      );
      
      const colWidth = columnWidths.get(node.gridCoord.x) ?? 0;
      const rowHeight = rowHeights.get(node.gridCoord.y) ?? 0;
      const nodeWidth = node.width ?? 0;
      const nodeHeight = node.height ?? 0;
      
      node.drawingCoord = {
        x: baseCoord.x + Math.floor((colWidth - nodeWidth) / 2),
        y: baseCoord.y + Math.floor((rowHeight - nodeHeight) / 2),
      };
    }
  }
  
  const totalHeight = calculateTotalHeight(rowHeights, effectiveOptions.paddingY);
  
  return {
    nodes,
    edges,
    backEdges,
    width: totalWidth,
    height: totalHeight,
    columnWidths,
    rowHeights,
  };
}
