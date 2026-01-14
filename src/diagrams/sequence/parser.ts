import type { SequenceAST, Participant, Message, MessageStyle, ArrowStyle } from './types.js';

const SEQUENCE_HEADER = /^sequenceDiagram\s*$/i;
const PARTICIPANT_PATTERN = /^participant\s+(\S+)(?:\s+as\s+(.+))?$/i;
const ACTOR_PATTERN = /^actor\s+(\S+)(?:\s+as\s+(.+))?$/i;

const MESSAGE_PATTERNS: Array<{
  pattern: RegExp;
  style: MessageStyle;
  arrowStyle: ArrowStyle;
}> = [
  // Order matters: longer arrow patterns must come before shorter ones
  { pattern: /^(\w+)\s*->>>\s*(\w+)\s*:\s*(.*)$/, style: 'solid', arrowStyle: 'filled' },
  { pattern: /^(\w+)\s*-->>>\s*(\w+)\s*:\s*(.*)$/, style: 'dotted', arrowStyle: 'filled' },
  { pattern: /^(\w+)\s*->>\s*(\w+)\s*:\s*(.*)$/, style: 'solid', arrowStyle: 'filled' },
  { pattern: /^(\w+)\s*-->>\s*(\w+)\s*:\s*(.*)$/, style: 'dotted', arrowStyle: 'filled' },
  { pattern: /^(\w+)\s*-->\s*(\w+)\s*:\s*(.*)$/, style: 'dotted', arrowStyle: 'open' },
  { pattern: /^(\w+)\s*->\s*(\w+)\s*:\s*(.*)$/, style: 'solid', arrowStyle: 'open' },
  { pattern: /^(\w+)\s*--x\s*(\w+)\s*:\s*(.*)$/, style: 'dotted', arrowStyle: 'filled' },
  { pattern: /^(\w+)\s*-x\s*(\w+)\s*:\s*(.*)$/, style: 'solid', arrowStyle: 'filled' },
];

function getOrCreateParticipant(
  participants: Map<string, Participant>,
  id: string,
  alias?: string
): Participant {
  let participant = participants.get(id);
  if (!participant) {
    participant = {
      id,
      alias: alias ?? id,
      index: participants.size,
    };
    participants.set(id, participant);
  } else if (alias && participant.alias === participant.id) {
    participant.alias = alias;
  }
  return participant;
}

export function parseSequence(input: string): SequenceAST {
  const lines = input.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('%%'));

  if (lines.length === 0) {
    throw new Error('Empty sequence diagram input');
  }

  if (!SEQUENCE_HEADER.test(lines[0])) {
    throw new Error(`Invalid sequence diagram header. Expected "sequenceDiagram", got: "${lines[0]}"`);
  }

  const participants = new Map<string, Participant>();
  const messages: Message[] = [];
  let messageIndex = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('Note ') || line.startsWith('note ')) continue;
    if (line.startsWith('loop ') || line.startsWith('alt ') || line.startsWith('opt ')) continue;
    if (line === 'end') continue;
    if (line.startsWith('rect ')) continue;
    if (line.startsWith('activate ') || line.startsWith('deactivate ')) continue;

    const participantMatch = line.match(PARTICIPANT_PATTERN);
    if (participantMatch) {
      const [, id, alias] = participantMatch;
      getOrCreateParticipant(participants, id, alias);
      continue;
    }

    const actorMatch = line.match(ACTOR_PATTERN);
    if (actorMatch) {
      const [, id, alias] = actorMatch;
      getOrCreateParticipant(participants, id, alias);
      continue;
    }

    for (const { pattern, style, arrowStyle } of MESSAGE_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        const [, from, to, text] = match;
        getOrCreateParticipant(participants, from);
        getOrCreateParticipant(participants, to);
        messages.push({
          from,
          to,
          text: text.trim(),
          style,
          arrowStyle,
          index: messageIndex++,
        });
        break;
      }
    }
  }

  return {
    type: 'sequence',
    participants,
    messages,
  };
}
