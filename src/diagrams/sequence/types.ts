import type { BaseDiagramAST } from '../../core/types.js';

export type MessageStyle = 'solid' | 'dotted';
export type ArrowStyle = 'filled' | 'open';

export interface Participant {
  id: string;
  alias: string;
  index: number;
}

export interface Message {
  from: string;
  to: string;
  text: string;
  style: MessageStyle;
  arrowStyle: ArrowStyle;
  index: number;
}

export interface SequenceAST extends BaseDiagramAST {
  type: 'sequence';
  participants: Map<string, Participant>;
  messages: Message[];
}
