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
  const label = node.displayLabel ?? node.label;
  
  canvas.drawBox(x, y, width, height);
  
  const textX = x + Math.floor((width - label.length) / 2);
  const textY = y + Math.floor(height / 2);
  canvas.drawText(textX, textY, label);
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

function canPlaceLabel(canvas: Canvas, x: number, y: number, label: string): boolean {
  if (x < 0 || y < 0) return false;
  for (let i = 0; i < label.length; i++) {
    if (canvas.isOccupied(x + i, y)) return false;
    const existing = canvas.get(x + i, y);
    if (existing !== ' ') return false;
  }
  return true;
}

interface EdgeRenderInfo {
  edge: FlowchartEdge;
  fromNode: FlowchartNode;
  toNode: FlowchartNode;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  dx: number;
  dy: number;
  isAligned: boolean;
}

const ALIGNMENT_THRESHOLD = 2;
const BRANCH_SPACING = 2;

function buildEdgeRenderInfo(
  edge: FlowchartEdge,
  fromNode: FlowchartNode,
  toNode: FlowchartNode,
  graphDirection: 'LR' | 'RL' | 'TD' | 'BT'
): EdgeRenderInfo {
  const { startDir, endDir } = determineEdgeDirection(fromNode, toNode, graphDirection);
  const startBorder = getNodeBorderPoint(fromNode, startDir);
  const endBorder = getNodeBorderPoint(toNode, endDir);
  
  const startX = startBorder.x + (startDir === 'right' ? 1 : startDir === 'left' ? -1 : 0);
  const startY = startBorder.y + (startDir === 'down' ? 1 : startDir === 'up' ? -1 : 0);
  const endX = endBorder.x;
  const endY = endBorder.y;
  
  const dx = endX - startX;
  const dy = endY - startY;
  
  const isVerticalFlow = graphDirection === 'TD' || graphDirection === 'BT';
  const isAligned = isVerticalFlow 
    ? Math.abs(dx) <= ALIGNMENT_THRESHOLD 
    : Math.abs(dy) <= ALIGNMENT_THRESHOLD;
  
  return { edge, fromNode, toNode, startX, startY, endX, endY, dx, dy, isAligned };
}

function drawAllEdges(
  canvas: Canvas,
  allEdgeInfos: EdgeRenderInfo[],
  graphDirection: 'LR' | 'RL' | 'TD' | 'BT',
  options: RenderOptions
): void {
  if (allEdgeInfos.length === 0) return;
  
  const chars = getCharacterSet(options.charset);
  const isVerticalFlow = graphDirection === 'TD' || graphDirection === 'BT';
  const hChar = chars.line.horizontal;
  const vChar = chars.line.vertical;
  
  const edgesBySource = new Map<string, EdgeRenderInfo[]>();
  const edgesByTarget = new Map<string, EdgeRenderInfo[]>();
  
  for (const info of allEdgeInfos) {
    const sourceKey = info.edge.from;
    const targetKey = info.edge.to;
    
    const sourceList = edgesBySource.get(sourceKey) ?? [];
    sourceList.push(info);
    edgesBySource.set(sourceKey, sourceList);
    
    const targetList = edgesByTarget.get(targetKey) ?? [];
    targetList.push(info);
    edgesByTarget.set(targetKey, targetList);
  }
  
  const drawnVerticals = new Map<string, number>();
  
  for (const [_sourceKey, edgeInfos] of edgesBySource) {
    const { startX, startY } = edgeInfos[0];
    
    if (isVerticalFlow) {
      const firstBranchY = startY + 1;
      const numEdges = edgeInfos.length;
      
      if (numEdges === 1 && edgeInfos[0].startX === edgeInfos[0].endX) {
        const info = edgeInfos[0];
        canvas.drawVerticalLine(info.endX, startY, info.endY, vChar);
        
        if (info.edge.label) {
          const labelX = info.endX + 2;
          const labelY = Math.floor((startY + info.endY) / 2);
          if (canPlaceLabel(canvas, labelX, labelY, info.edge.label)) {
            canvas.drawText(labelX, labelY, info.edge.label);
          }
        }
      } else {
        const lastBranchY = firstBranchY + (numEdges - 1) * BRANCH_SPACING;
        canvas.drawVerticalLine(startX, startY, lastBranchY, vChar);
        
        for (let i = 0; i < numEdges; i++) {
          const info = edgeInfos[i];
          const branchY = firstBranchY + i * BRANCH_SPACING;
          const goingRight = info.dx > 0;
          canvas.drawHorizontalLine(Math.min(startX, info.endX), Math.max(startX, info.endX), branchY, hChar);
          
          const vertKey = `${info.endX}:${info.endY}`;
          const existingBranchY = drawnVerticals.get(vertKey);
          
          if (existingBranchY !== undefined) {
            if (branchY < existingBranchY) {
              canvas.drawVerticalLine(info.endX, branchY, existingBranchY, vChar);
              drawnVerticals.set(vertKey, branchY);
            }
          } else {
            canvas.drawVerticalLine(info.endX, branchY, info.endY, vChar);
            drawnVerticals.set(vertKey, branchY);
          }
          
          if (info.edge.label) {
            const preferredX = goingRight ? info.endX + 1 : Math.max(0, info.endX - info.edge.label.length - 1);
            const altX = goingRight 
              ? Math.max(0, startX - info.edge.label.length - 1)
              : info.endX + 1;
            
            const labelPositions = [
              { x: preferredX, y: branchY },
              { x: altX, y: branchY },
              { x: preferredX, y: branchY + 1 },
              { x: altX, y: branchY + 1 },
            ];
            
            for (const pos of labelPositions) {
              if (canPlaceLabel(canvas, pos.x, pos.y, info.edge.label)) {
                canvas.drawText(pos.x, pos.y, info.edge.label);
                break;
              }
            }
          }
        }
      }
    } else {
      const firstBranchX = startX + 2;
      const numEdges = edgeInfos.length;
      
      if (numEdges === 1 && edgeInfos[0].startY === edgeInfos[0].endY) {
        const info = edgeInfos[0];
        canvas.drawHorizontalLine(startX, info.endX, info.endY, hChar);
        
        if (info.edge.label) {
          const labelX = Math.floor((startX + info.endX) / 2) - Math.floor(info.edge.label.length / 2);
          const labelY = startY - 1;
          if (canPlaceLabel(canvas, labelX, labelY, info.edge.label)) {
            canvas.drawText(labelX, labelY, info.edge.label);
          }
        }
      } else {
        const lastBranchX = firstBranchX + (numEdges - 1) * BRANCH_SPACING;
        canvas.drawHorizontalLine(startX, lastBranchX, startY, hChar);
        
        for (let i = 0; i < numEdges; i++) {
          const info = edgeInfos[i];
          const branchX = firstBranchX + i * BRANCH_SPACING;
          const goingDown = info.dy > 0;
          
          canvas.drawVerticalLine(branchX, Math.min(startY, info.endY), Math.max(startY, info.endY), vChar);
          canvas.drawHorizontalLine(branchX, info.endX, info.endY, hChar);
          
          if (info.edge.label) {
            const labelX = branchX + 1;
            const labelY = goingDown ? startY + 1 : info.endY + 1;
            if (canPlaceLabel(canvas, labelX, labelY, info.edge.label)) {
              canvas.drawText(labelX, labelY, info.edge.label);
            }
          }
        }
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
  
  for (const node of layout.nodes.values()) {
    drawNode(canvas, node);
  }
  
  const forwardEdges: EdgeRenderInfo[] = [];
  for (const edge of layout.edges) {
    const fromNode = layout.nodes.get(edge.from);
    const toNode = layout.nodes.get(edge.to);
    if (!fromNode || !toNode) continue;
    
    if (layout.backEdges.has(edge)) {
      drawBackEdge(canvas, edge, fromNode, toNode, ast.direction, options);
    } else {
      const info = buildEdgeRenderInfo(edge, fromNode, toNode, ast.direction);
      forwardEdges.push(info);
    }
  }
  
  drawAllEdges(canvas, forwardEdges, ast.direction, options);
  
  const chars = getCharacterSet(options.charset);
  for (const edge of layout.edges) {
    const toNode = layout.nodes.get(edge.to);
    if (toNode && edge.arrowType !== 'open') {
      const isBackEdge = layout.backEdges.has(edge);
      
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
