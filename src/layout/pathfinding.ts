import type { GridCoord, Direction } from '../core/types.js';

interface PathNode {
  coord: GridCoord;
  g: number;
  h: number;
  f: number;
  parent: PathNode | null;
}

function heuristic(a: GridCoord, b: GridCoord): number {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return dx + dy;
}

function coordKey(coord: GridCoord): string {
  return `${coord.x},${coord.y}`;
}

function getNeighbors(coord: GridCoord): GridCoord[] {
  return [
    { x: coord.x + 1, y: coord.y },
    { x: coord.x - 1, y: coord.y },
    { x: coord.x, y: coord.y + 1 },
    { x: coord.x, y: coord.y - 1 },
  ];
}

export function findPath(
  start: GridCoord,
  end: GridCoord,
  obstacles: Set<string>,
  maxIterations: number = 1000
): GridCoord[] | null {
  const openSet: PathNode[] = [];
  const closedSet = new Set<string>();
  
  const startNode: PathNode = {
    coord: start,
    g: 0,
    h: heuristic(start, end),
    f: heuristic(start, end),
    parent: null,
  };
  
  openSet.push(startNode);
  
  let iterations = 0;
  
  while (openSet.length > 0 && iterations < maxIterations) {
    iterations++;
    
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift()!;
    const currentKey = coordKey(current.coord);
    
    if (current.coord.x === end.x && current.coord.y === end.y) {
      const path: GridCoord[] = [];
      let node: PathNode | null = current;
      while (node) {
        path.unshift(node.coord);
        node = node.parent;
      }
      return path;
    }
    
    closedSet.add(currentKey);
    
    for (const neighbor of getNeighbors(current.coord)) {
      const neighborKey = coordKey(neighbor);
      
      if (closedSet.has(neighborKey) || obstacles.has(neighborKey)) {
        continue;
      }
      
      const g = current.g + 1;
      const h = heuristic(neighbor, end);
      const f = g + h;
      
      const existingNode = openSet.find(
        n => n.coord.x === neighbor.x && n.coord.y === neighbor.y
      );
      
      if (existingNode) {
        if (g < existingNode.g) {
          existingNode.g = g;
          existingNode.f = f;
          existingNode.parent = current;
        }
      } else {
        openSet.push({
          coord: neighbor,
          g,
          h,
          f,
          parent: current,
        });
      }
    }
  }
  
  return null;
}

export function simplifyPath(path: GridCoord[]): GridCoord[] {
  if (path.length <= 2) return path;
  
  const simplified: GridCoord[] = [path[0]];
  
  for (let i = 1; i < path.length - 1; i++) {
    const prev = path[i - 1];
    const curr = path[i];
    const next = path[i + 1];
    
    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;
    
    if (dx1 !== dx2 || dy1 !== dy2) {
      simplified.push(curr);
    }
  }
  
  simplified.push(path[path.length - 1]);
  return simplified;
}

export function getDirection(from: GridCoord, to: GridCoord): Direction {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  } else {
    return dy > 0 ? 'down' : 'up';
  }
}

export function getOppositeDirection(dir: Direction): Direction {
  switch (dir) {
    case 'up': return 'down';
    case 'down': return 'up';
    case 'left': return 'right';
    case 'right': return 'left';
  }
}
