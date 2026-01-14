import type { GraphDirection, NodeShape, EdgeStyle, ArrowType, StyleClass } from '../../core/types.js';
import type { FlowchartAST, FlowchartNode, FlowchartEdge, Subgraph } from './types.js';

interface ParsedNode {
  id: string;
  label: string;
  shape: NodeShape;
  styleClass?: string;
}



const DIRECTION_PATTERN = /^(?:graph|flowchart)\s+(LR|RL|TD|TB|BT)\s*$/i;
const NODE_DEF_PATTERNS: Array<{ pattern: RegExp; shape: NodeShape }> = [
  { pattern: /^(\w+)\[\[(.+)\]\]$/, shape: 'subroutine' },
  { pattern: /^(\w+)\[\((.+)\)\]$/, shape: 'cylinder' },
  { pattern: /^(\w+)\(\((.+)\)\)$/, shape: 'circle' },
  { pattern: /^(\w+)\{\{(.+)\}\}$/, shape: 'hexagon' },
  { pattern: /^(\w+)\{(.+)\}$/, shape: 'diamond' },
  { pattern: /^(\w+)\((.+)\)$/, shape: 'round' },
  { pattern: /^(\w+)\[\/(.+)\/\]$/, shape: 'parallelogram' },
  { pattern: /^(\w+)\[\\(.+)\\\]$/, shape: 'parallelogram' },
  { pattern: /^(\w+)>(.+)\]$/, shape: 'asymmetric' },
  { pattern: /^(\w+)\[(.+)\]$/, shape: 'rect' },
  { pattern: /^(\w+)$/, shape: 'rect' },
];

const EDGE_PATTERNS = [
  { pattern: /^-->\|(.+?)\|$/, style: 'solid' as EdgeStyle, arrowType: 'arrow' as ArrowType, hasLabel: true },
  { pattern: /^-->$/, style: 'solid' as EdgeStyle, arrowType: 'arrow' as ArrowType, hasLabel: false },
  { pattern: /^---\|(.+?)\|$/, style: 'solid' as EdgeStyle, arrowType: 'open' as ArrowType, hasLabel: true },
  { pattern: /^---$/, style: 'solid' as EdgeStyle, arrowType: 'open' as ArrowType, hasLabel: false },
  { pattern: /^-\.->\|(.+?)\|$/, style: 'dotted' as EdgeStyle, arrowType: 'arrow' as ArrowType, hasLabel: true },
  { pattern: /^-\.->$/, style: 'dotted' as EdgeStyle, arrowType: 'arrow' as ArrowType, hasLabel: false },
  { pattern: /^-\.-\|(.+?)\|$/, style: 'dotted' as EdgeStyle, arrowType: 'open' as ArrowType, hasLabel: true },
  { pattern: /^-\.-$/, style: 'dotted' as EdgeStyle, arrowType: 'open' as ArrowType, hasLabel: false },
  { pattern: /^==>\|(.+?)\|$/, style: 'thick' as EdgeStyle, arrowType: 'arrow' as ArrowType, hasLabel: true },
  { pattern: /^==>$/, style: 'thick' as EdgeStyle, arrowType: 'arrow' as ArrowType, hasLabel: false },
  { pattern: /^--o$/, style: 'solid' as EdgeStyle, arrowType: 'circle' as ArrowType, hasLabel: false },
  { pattern: /^--x$/, style: 'solid' as EdgeStyle, arrowType: 'cross' as ArrowType, hasLabel: false },
  { pattern: /^<-->$/, style: 'solid' as EdgeStyle, arrowType: 'arrow' as ArrowType, hasLabel: false, bidirectional: true },
];

const CLASSDEF_PATTERN = /^classDef\s+(\w+)\s+(.+)$/;
const CLASS_ASSIGNMENT_PATTERN = /^class\s+(.+)\s+(\w+)$/;
const NODE_CLASS_PATTERN = /^(\w+):::(\w+)$/;
const AMPERSAND_SPLIT = /\s*&\s*/;

function parseNodeDefinition(text: string): ParsedNode {
  const trimmed = text.trim();
  
  const classMatch = trimmed.match(NODE_CLASS_PATTERN);
  let nodeText = trimmed;
  let styleClass: string | undefined;
  
  if (classMatch) {
    nodeText = classMatch[1];
    styleClass = classMatch[2];
  }
  
  for (const { pattern, shape } of NODE_DEF_PATTERNS) {
    const match = nodeText.match(pattern);
    if (match) {
      const id = match[1];
      const label = match[2] ?? match[1];
      return { id, label, shape, styleClass };
    }
  }
  
  return { id: trimmed, label: trimmed, shape: 'rect', styleClass };
}

function parseEdgeOperator(text: string): { style: EdgeStyle; arrowType: ArrowType; label?: string; bidirectional: boolean } | null {
  for (const edgeDef of EDGE_PATTERNS) {
    const match = text.match(edgeDef.pattern);
    if (match) {
      return {
        style: edgeDef.style,
        arrowType: edgeDef.arrowType,
        label: edgeDef.hasLabel ? match[1] : undefined,
        bidirectional: edgeDef.bidirectional ?? false,
      };
    }
  }
  return null;
}

function parseStyleClass(propsString: string): Partial<StyleClass> {
  const props: Partial<StyleClass> = {};
  const pairs = propsString.split(',');
  
  for (const pair of pairs) {
    const [key, value] = pair.split(':').map(s => s.trim());
    if (key && value) {
      switch (key) {
        case 'fill': props.fill = value; break;
        case 'stroke': props.stroke = value; break;
        case 'color': props.color = value; break;
        case 'stroke-width': props.strokeWidth = value; break;
      }
    }
  }
  
  return props;
}

const EDGE_OPERATOR_REGEX = /(<-->|-->\|[^|]+\||-->|---\|[^|]+\||---|-\.->\|[^|]+\||-\.->|-\.-\|[^|]+\||-\.-|==>\|[^|]+\||==>|--o|--x)/;

function tokenizeEdgeLine(line: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inBracket = 0;
  let inParen = 0;
  let inBrace = 0;
  let inPipe = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '[') inBracket++;
    else if (char === ']') inBracket--;
    else if (char === '(') inParen++;
    else if (char === ')') inParen--;
    else if (char === '{') inBrace++;
    else if (char === '}') inBrace--;
    else if (char === '|') inPipe = !inPipe;
    
    const inContainer = inBracket > 0 || inParen > 0 || inBrace > 0 || inPipe;
    
    if (!inContainer && char === ' ') {
      if (current.trim()) {
        tokens.push(current.trim());
      }
      current = '';
    } else {
      current += char;
    }
  }
  
  if (current.trim()) {
    tokens.push(current.trim());
  }
  
  const expandedTokens: string[] = [];
  for (const token of tokens) {
    const parts = token.split(EDGE_OPERATOR_REGEX).filter(p => p);
    if (parts.length > 1) {
      expandedTokens.push(...parts);
    } else {
      expandedTokens.push(token);
    }
  }
  
  return expandedTokens;
}

export function parseFlowchart(input: string): FlowchartAST {
  const trimmedInput = input.trim();
  const normalizedInput = trimmedInput.includes(';')
    ? trimmedInput.replace(/;/g, '\n')
    : trimmedInput;
  const lines = normalizedInput.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('%%'));
  
  if (lines.length === 0) {
    throw new Error('Empty flowchart input');
  }
  
  const directionMatch = lines[0].match(DIRECTION_PATTERN);
  if (!directionMatch) {
    throw new Error(`Invalid flowchart header. Expected "graph LR|RL|TD|TB|BT" or "flowchart LR|RL|TD|TB|BT", got: "${lines[0]}"`);
  }
  
  let direction = directionMatch[1].toUpperCase();
  if (direction === 'TB') direction = 'TD';
  const graphDirection = direction as GraphDirection;
  
  const nodes = new Map<string, FlowchartNode>();
  const edges: FlowchartEdge[] = [];
  const styleClasses = new Map<string, StyleClass>();
  const subgraphs: Subgraph[] = [];
  const nodeClassAssignments = new Map<string, string>();
  
  let nodeIndex = 0;
  let edgeIndex = 0;
  
  function getOrCreateNode(parsed: ParsedNode): FlowchartNode {
    let node = nodes.get(parsed.id);
    if (!node) {
      node = {
        id: parsed.id,
        label: parsed.label,
        shape: parsed.shape,
        styleClass: parsed.styleClass,
        index: nodeIndex++,
      };
      nodes.set(parsed.id, node);
    } else {
      if (parsed.label !== parsed.id) {
        node.label = parsed.label;
      }
      if (parsed.shape !== 'rect') {
        node.shape = parsed.shape;
      }
      if (parsed.styleClass) {
        node.styleClass = parsed.styleClass;
      }
    }
    return node;
  }
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    
    const classDefMatch = line.match(CLASSDEF_PATTERN);
    if (classDefMatch) {
      const [, name, propsString] = classDefMatch;
      const props = parseStyleClass(propsString);
      styleClasses.set(name, { name, ...props });
      continue;
    }
    
    const classAssignMatch = line.match(CLASS_ASSIGNMENT_PATTERN);
    if (classAssignMatch) {
      const [, nodeIds, className] = classAssignMatch;
      for (const nodeId of nodeIds.split(',').map(s => s.trim())) {
        nodeClassAssignments.set(nodeId, className);
      }
      continue;
    }
    
    if (line.startsWith('subgraph') || line === 'end') {
      continue;
    }
    
    const tokens = tokenizeEdgeLine(line);
    if (tokens.length === 0) continue;
    
    if (tokens.length === 1) {
      const ampersandParts = tokens[0].split(AMPERSAND_SPLIT);
      for (const part of ampersandParts) {
        const parsed = parseNodeDefinition(part);
        getOrCreateNode(parsed);
      }
      continue;
    }
    
    let currentFromNodes: ParsedNode[] = [];
    let expectingEdge = false;
    
    for (const token of tokens) {
      const edgeOp = parseEdgeOperator(token);
      
      if (edgeOp) {
        expectingEdge = true;
        continue;
      }
      
      const ampersandParts = token.split(AMPERSAND_SPLIT);
      const parsedNodes = ampersandParts.map(parseNodeDefinition);
      
      if (currentFromNodes.length > 0 && expectingEdge) {
        const lastEdgeOp = (() => {
          for (let j = tokens.indexOf(token) - 1; j >= 0; j--) {
            const op = parseEdgeOperator(tokens[j]);
            if (op) return op;
          }
          return { style: 'solid' as EdgeStyle, arrowType: 'arrow' as ArrowType, label: undefined, bidirectional: false };
        })();
        
        for (const fromParsed of currentFromNodes) {
          const fromNode = getOrCreateNode(fromParsed);
          for (const toParsed of parsedNodes) {
            const toNode = getOrCreateNode(toParsed);
            edges.push({
              from: fromNode.id,
              to: toNode.id,
              label: lastEdgeOp.label,
              style: lastEdgeOp.style,
              arrowType: lastEdgeOp.arrowType,
              bidirectional: lastEdgeOp.bidirectional,
              index: edgeIndex++,
            });
            
            if (lastEdgeOp.bidirectional) {
              edges.push({
                from: toNode.id,
                to: fromNode.id,
                style: lastEdgeOp.style,
                arrowType: lastEdgeOp.arrowType,
                bidirectional: false,
                index: edgeIndex++,
              });
            }
          }
        }
      }
      
      currentFromNodes = parsedNodes;
      expectingEdge = false;
    }
  }
  
  for (const [nodeId, className] of nodeClassAssignments) {
    const node = nodes.get(nodeId);
    if (node) {
      node.styleClass = className;
    }
  }
  
  return {
    type: 'flowchart',
    direction: graphDirection,
    nodes,
    edges,
    subgraphs,
    styleClasses,
  };
}
