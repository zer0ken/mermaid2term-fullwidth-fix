import { Canvas } from '../../core/canvas.js';
import { getCharacterSet } from '../../core/characters.js';
import type { RenderOptions, Direction } from '../../core/types.js';
import type { FlowchartAST, FlowchartNode, FlowchartEdge } from './types.js';
import { layoutFlowchart } from '../../layout/sugiyama.js';

function drawNode(
  canvas: Canvas,
  node: FlowchartNode
): void {
  if (!node.drawingCoord || !node.width || !node.height) return;
  
  const { x, y } = node.drawingCoord;
  const { width, height } = node;
  
  canvas.drawBox(x, y, width, height);
  
  const textX = x + Math.floor((width - node.label.length) / 2);
  const textY = y + Math.floor(height / 2);
  canvas.drawText(textX, textY, node.label);
}

function getNodeCenter(node: FlowchartNode): { x: number; y: number } {
  if (!node.drawingCoord || !node.width || !node.height) {
    return { x: 0, y: 0 };
  }
  const { x, y } = node.drawingCoord;
  return {
    x: x + Math.floor(node.width / 2),
    y: y + Math.floor(node.height / 2),
  };
}

function getNodeBorderPoint(
  node: FlowchartNode,
  direction: Direction
): { x: number; y: number } {
  if (!node.drawingCoord || !node.width || !node.height) {
    return { x: 0, y: 0 };
  }
  
  const { x, y } = node.drawingCoord;
  const { width, height } = node;
  const centerX = x + Math.floor(width / 2);
  const centerY = y + Math.floor(height / 2);
  
  switch (direction) {
    case 'right':
      return { x: x + width - 1, y: centerY };
    case 'left':
      return { x, y: centerY };
    case 'down':
      return { x: centerX, y: y + height - 1 };
    case 'up':
      return { x: centerX, y };
  }
}

function determineEdgeDirection(
  fromNode: FlowchartNode,
  toNode: FlowchartNode,
  graphDirection: 'LR' | 'RL' | 'TD' | 'BT'
): { startDir: Direction; endDir: Direction } {
  const fromCenter = getNodeCenter(fromNode);
  const toCenter = getNodeCenter(toNode);
  
  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;
  
  switch (graphDirection) {
    case 'LR':
      if (dx > 0) return { startDir: 'right', endDir: 'left' };
      if (dx < 0) return { startDir: 'left', endDir: 'right' };
      return dy > 0 ? { startDir: 'down', endDir: 'up' } : { startDir: 'up', endDir: 'down' };
    
    case 'RL':
      if (dx < 0) return { startDir: 'left', endDir: 'right' };
      if (dx > 0) return { startDir: 'right', endDir: 'left' };
      return dy > 0 ? { startDir: 'down', endDir: 'up' } : { startDir: 'up', endDir: 'down' };
    
    case 'TD':
      if (dy > 0) return { startDir: 'down', endDir: 'up' };
      if (dy < 0) return { startDir: 'up', endDir: 'down' };
      return dx > 0 ? { startDir: 'right', endDir: 'left' } : { startDir: 'left', endDir: 'right' };
    
    case 'BT':
      if (dy < 0) return { startDir: 'up', endDir: 'down' };
      if (dy > 0) return { startDir: 'down', endDir: 'up' };
      return dx > 0 ? { startDir: 'right', endDir: 'left' } : { startDir: 'left', endDir: 'right' };
  }
}

function drawBackEdge(
  canvas: Canvas,
  edge: FlowchartEdge,
  fromNode: FlowchartNode,
  toNode: FlowchartNode,
  graphDirection: 'LR' | 'RL' | 'TD' | 'BT',
  options: RenderOptions
): void {
  const chars = getCharacterSet(options.charset);
  const isVertical = graphDirection === 'TD' || graphDirection === 'BT';
  
  const hChar = edge.style === 'dotted' ? chars.line.dottedHorizontal
    : edge.style === 'thick' ? chars.line.thickHorizontal
    : chars.line.horizontal;
    
  const vChar = edge.style === 'dotted' ? chars.line.dottedVertical
    : edge.style === 'thick' ? chars.line.thickVertical
    : chars.line.vertical;

  if (isVertical) {
    // TD/BT: Back-edge goes out the right side, up, then into the right side of target
    const fromRight = getNodeBorderPoint(fromNode, 'right');
    const toRight = getNodeBorderPoint(toNode, 'right');
    
    const loopX = Math.max(fromRight.x, toRight.x) + 3;
    
    // Draw: right from source -> up/down -> left into target
    canvas.drawHorizontalLine(fromRight.x + 1, loopX, fromRight.y, hChar);
    canvas.drawVerticalLine(loopX, Math.min(fromRight.y, toRight.y), Math.max(fromRight.y, toRight.y), vChar);
    canvas.drawHorizontalLine(toRight.x + 1, loopX, toRight.y, hChar);
  } else {
    // LR/RL: Back-edge goes out the bottom, left/right, then into the bottom of target
    const fromBottom = getNodeBorderPoint(fromNode, 'down');
    const toBottom = getNodeBorderPoint(toNode, 'down');
    
    const loopY = Math.max(fromBottom.y, toBottom.y) + 2;
    
    // Draw: down from source -> left/right -> up into target
    canvas.drawVerticalLine(fromBottom.x, fromBottom.y + 1, loopY, vChar);
    canvas.drawHorizontalLine(Math.min(fromBottom.x, toBottom.x), Math.max(fromBottom.x, toBottom.x), loopY, hChar);
    canvas.drawVerticalLine(toBottom.x, toBottom.y + 1, loopY, vChar);
  }
}

function drawEdge(
  canvas: Canvas,
  edge: FlowchartEdge,
  fromNode: FlowchartNode,
  toNode: FlowchartNode,
  graphDirection: 'LR' | 'RL' | 'TD' | 'BT',
  options: RenderOptions,
  isBackEdge: boolean = false,
  sourceIndex: number = 0,
  totalFromSource: number = 1,
  targetIndex: number = 0,
  totalToTarget: number = 1
): void {
  // Handle back-edges specially - route them around nodes
  if (isBackEdge) {
    drawBackEdge(canvas, edge, fromNode, toNode, graphDirection, options);
    return;
  }

  const chars = getCharacterSet(options.charset);
  const { startDir, endDir } = determineEdgeDirection(fromNode, toNode, graphDirection);
  
  const startBorder = getNodeBorderPoint(fromNode, startDir);
  const endBorder = getNodeBorderPoint(toNode, endDir);
  
  const hChar = edge.style === 'dotted' ? chars.line.dottedHorizontal
    : edge.style === 'thick' ? chars.line.thickHorizontal
    : chars.line.horizontal;
    
  const vChar = edge.style === 'dotted' ? chars.line.dottedVertical
    : edge.style === 'thick' ? chars.line.thickVertical
    : chars.line.vertical;

  let startX = startBorder.x;
  let startY = startBorder.y;
  let endX = endBorder.x;
  let endY = endBorder.y;
  
  if (startDir === 'right') startX += 1;
  else if (startDir === 'left') startX -= 1;
  else if (startDir === 'down') startY += 1;
  else if (startDir === 'up') startY -= 1;

  const dx = Math.abs(endX - startX);
  const dy = Math.abs(endY - startY);
  const isVerticalPrimary = startDir === 'down' || startDir === 'up';
  const isHorizontalPrimary = startDir === 'left' || startDir === 'right';
  
  const alignmentTolerance = 3;
  const effectivelyAlignedX = dx <= alignmentTolerance && isVerticalPrimary;
  const effectivelyAlignedY = dy <= alignmentTolerance && isHorizontalPrimary;

  if (startY === endY || effectivelyAlignedY) {
    canvas.drawHorizontalLine(Math.min(startX, endX), Math.max(startX, endX), startY, hChar);
  } else if (startX === endX || effectivelyAlignedX) {
    canvas.drawVerticalLine(endX, Math.min(startY, endY), Math.max(startY, endY), vChar);
  } else {
    const isVerticalFirst = startDir === 'down' || startDir === 'up';
    
    if (isVerticalFirst) {
      const sourceOffset = totalFromSource > 1 ? (sourceIndex - Math.floor(totalFromSource / 2)) * 2 : 0;
      const baseTurnY = endY + (endDir === 'up' ? -2 : 2);
      const turnY = totalToTarget > 1 ? baseTurnY : baseTurnY + sourceOffset;
      
      canvas.drawVerticalLine(startX, Math.min(startY, turnY), Math.max(startY, turnY), vChar);
      canvas.drawHorizontalLine(Math.min(startX, endX), Math.max(startX, endX), turnY, hChar);
      
      if (targetIndex === 0) {
        canvas.drawVerticalLine(endX, Math.min(turnY, endY), Math.max(turnY, endY), vChar);
      }
    } else {
      const sourceOffset = totalFromSource > 1 ? (sourceIndex - Math.floor(totalFromSource / 2)) * 2 : 0;
      const baseTurnX = endX + (endDir === 'left' ? -2 : 2);
      const turnX = totalToTarget > 1 ? baseTurnX : baseTurnX + sourceOffset;
      
      canvas.drawHorizontalLine(Math.min(startX, turnX), Math.max(startX, turnX), startY, hChar);
      canvas.drawVerticalLine(turnX, Math.min(startY, endY), Math.max(startY, endY), vChar);
      
      if (targetIndex === 0) {
        canvas.drawHorizontalLine(Math.min(turnX, endX), Math.max(turnX, endX), endY, hChar);
      }
    }
  }
  

  
  if (edge.label) {
    const isHorizontalEdge = startY === endY || effectivelyAlignedY;
    const isVerticalEdge = startX === endX || effectivelyAlignedX;
    
    if (isHorizontalEdge) {
      const availableSpace = Math.abs(endX - startX) - 2;
      if (availableSpace >= edge.label.length) {
        const midX = Math.floor((startX + endX) / 2);
        const labelX = midX - Math.floor(edge.label.length / 2);
        canvas.drawText(labelX, startY - 1, edge.label);
      }
    } else if (isVerticalEdge) {
      const midY = Math.floor((startY + endY) / 2);
      canvas.drawText(endX + 2, midY, edge.label);
    } else {
      const isVerticalFirst = startDir === 'down' || startDir === 'up';
      if (isVerticalFirst) {
        const labelX = endX + 1;
        const labelY = endY - 2;
        canvas.drawText(labelX, labelY, edge.label);
      } else {
        const labelY = Math.min(startY, endY) + Math.floor(Math.abs(endY - startY) / 2);
        const labelX = endX + 2;
        canvas.drawText(labelX, labelY, edge.label);
      }
    }
  }
}

export function renderFlowchart(
  ast: FlowchartAST,
  options: RenderOptions
): string {
  const layout = layoutFlowchart(ast, options);
  
  if (layout.nodes.size === 0) {
    return '';
  }
  
  const canvas = new Canvas(layout.width + 10, layout.height + 10, options.charset);
  
  const edgesBySource = new Map<string, FlowchartEdge[]>();
  const edgesByTarget = new Map<string, FlowchartEdge[]>();
  for (const edge of layout.edges) {
    const fromList = edgesBySource.get(edge.from) ?? [];
    fromList.push(edge);
    edgesBySource.set(edge.from, fromList);
    
    const toList = edgesByTarget.get(edge.to) ?? [];
    toList.push(edge);
    edgesByTarget.set(edge.to, toList);
  }
  
  for (const edge of layout.edges) {
    const fromNode = layout.nodes.get(edge.from);
    const toNode = layout.nodes.get(edge.to);
    
    if (fromNode && toNode) {
      const isBackEdge = layout.backEdges.has(edge);
      const edgesFromSameSource = edgesBySource.get(edge.from) ?? [];
      const edgesToSameTarget = edgesByTarget.get(edge.to) ?? [];
      const sourceIndex = edgesFromSameSource.indexOf(edge);
      const targetIndex = edgesToSameTarget.indexOf(edge);
      drawEdge(
        canvas, edge, fromNode, toNode, ast.direction, options,
        isBackEdge,
        sourceIndex, edgesFromSameSource.length,
        targetIndex, edgesToSameTarget.length
      );
    }
  }
  
  for (const node of layout.nodes.values()) {
    drawNode(canvas, node);
  }
  
  for (const edge of layout.edges) {
    const toNode = layout.nodes.get(edge.to);
    if (toNode && edge.arrowType !== 'open') {
      const isBackEdge = layout.backEdges.has(edge);
      const chars = getCharacterSet(options.charset);
      
      let endDir: Direction;
      if (isBackEdge) {
        const isVertical = ast.direction === 'TD' || ast.direction === 'BT';
        endDir = isVertical ? 'right' : 'down';
      } else {
        endDir = determineEdgeDirection(
          layout.nodes.get(edge.from)!,
          toNode,
          ast.direction
        ).endDir;
      }
      
      const endBorder = getNodeBorderPoint(toNode, endDir);
      const arrowChar = edge.arrowType === 'arrow'
        ? (endDir === 'left' ? chars.arrow.right
          : endDir === 'right' ? chars.arrow.left
          : endDir === 'up' ? chars.arrow.down
          : chars.arrow.up)
        : edge.arrowType === 'circle' ? chars.arrow.circle
        : chars.arrow.cross;
      canvas.forceSet(endBorder.x, endBorder.y, arrowChar);
    }
  }
  
  return canvas.toString();
}
