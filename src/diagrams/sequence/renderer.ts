import { Canvas } from '../../core/canvas.js';
import { getCharacterSet } from '../../core/characters.js';
import type { RenderOptions } from '../../core/types.js';
import type { SequenceAST, Participant, Message } from './types.js';

const PARTICIPANT_BOX_HEIGHT = 3;
const PARTICIPANT_PADDING = 2;
const PARTICIPANT_GAP = 6;
const MESSAGE_ROW_HEIGHT = 2;
const LIFELINE_START_OFFSET = 2;

interface ParticipantLayout {
  participant: Participant;
  x: number;
  width: number;
  centerX: number;
}

interface SequenceLayout {
  participants: ParticipantLayout[];
  participantMap: Map<string, ParticipantLayout>;
  width: number;
  height: number;
}

function layoutSequence(ast: SequenceAST, _options: RenderOptions): SequenceLayout {
  const participantList = Array.from(ast.participants.values()).sort((a, b) => a.index - b.index);
  const layouts: ParticipantLayout[] = [];
  const participantMap = new Map<string, ParticipantLayout>();

  let currentX = PARTICIPANT_PADDING;

  for (const participant of participantList) {
    const labelWidth = participant.alias.length;
    const boxWidth = Math.max(labelWidth + 4, 7);

    const layout: ParticipantLayout = {
      participant,
      x: currentX,
      width: boxWidth,
      centerX: currentX + Math.floor(boxWidth / 2),
    };

    layouts.push(layout);
    participantMap.set(participant.id, layout);

    currentX += boxWidth + PARTICIPANT_GAP;
  }

  const totalWidth = currentX - PARTICIPANT_GAP + PARTICIPANT_PADDING;

  const lifelineHeight = ast.messages.length * MESSAGE_ROW_HEIGHT + LIFELINE_START_OFFSET;
  const totalHeight = PARTICIPANT_BOX_HEIGHT + lifelineHeight + PARTICIPANT_BOX_HEIGHT + 2;

  return {
    participants: layouts,
    participantMap,
    width: totalWidth,
    height: totalHeight,
  };
}

function drawParticipantBox(
  canvas: Canvas,
  layout: ParticipantLayout,
  y: number
): void {
  canvas.drawBox(layout.x, y, layout.width, PARTICIPANT_BOX_HEIGHT);

  const textX = layout.x + Math.floor((layout.width - layout.participant.alias.length) / 2);
  const textY = y + 1;
  canvas.drawText(textX, textY, layout.participant.alias);
}

function drawLifeline(
  canvas: Canvas,
  layout: ParticipantLayout,
  startY: number,
  endY: number,
  chars: ReturnType<typeof getCharacterSet>
): void {
  const x = layout.centerX;
  for (let y = startY; y <= endY; y++) {
    canvas.set(x, y, chars.line.vertical);
  }
}

function drawMessage(
  canvas: Canvas,
  message: Message,
  fromLayout: ParticipantLayout,
  toLayout: ParticipantLayout,
  y: number,
  chars: ReturnType<typeof getCharacterSet>
): void {
  const fromX = fromLayout.centerX;
  const toX = toLayout.centerX;

  const isSelfMessage = fromLayout.participant.id === toLayout.participant.id;

  if (isSelfMessage) {
    const loopWidth = 4;
    const lineChar = message.style === 'dotted' ? chars.line.dottedHorizontal : chars.line.horizontal;
    const vChar = message.style === 'dotted' ? chars.line.dottedVertical : chars.line.vertical;

    canvas.drawHorizontalLine(fromX, fromX + loopWidth, y, lineChar);
    canvas.set(fromX + loopWidth, y, vChar);
    canvas.set(fromX + loopWidth, y + 1, vChar);
    canvas.drawHorizontalLine(fromX, fromX + loopWidth, y + 1, lineChar);
    canvas.forceSet(fromX, y + 1, chars.arrow.left);

    if (message.text) {
      canvas.drawText(fromX + loopWidth + 2, y, message.text);
    }
    return;
  }

  const isLeftToRight = fromX < toX;
  const startX = isLeftToRight ? fromX + 1 : fromX - 1;
  const endX = isLeftToRight ? toX - 1 : toX + 1;

  const lineChar = message.style === 'dotted' ? chars.line.dottedHorizontal : chars.line.horizontal;

  canvas.drawHorizontalLine(startX, endX, y, lineChar);

  const arrowChar = message.arrowStyle === 'filled'
    ? (isLeftToRight ? chars.arrow.right : chars.arrow.left)
    : (isLeftToRight ? chars.arrow.rightOpen : chars.arrow.leftOpen);

  canvas.forceSet(isLeftToRight ? toX : toX, y, arrowChar);

  if (message.text) {
    const textLen = message.text.length;
    const midX = Math.floor((fromX + toX) / 2);
    const textX = midX - Math.floor(textLen / 2);
    canvas.drawText(textX, y - 1, message.text);
  }
}

export function renderSequence(
  ast: SequenceAST,
  options: RenderOptions
): string {
  if (ast.participants.size === 0) {
    return '';
  }

  const layout = layoutSequence(ast, options);
  const chars = getCharacterSet(options.charset);
  const canvas = new Canvas(layout.width + 4, layout.height + 4, options.charset);

  const topBoxY = options.paddingY;
  for (const pLayout of layout.participants) {
    drawParticipantBox(canvas, pLayout, topBoxY);
  }

  const lifelineStartY = topBoxY + PARTICIPANT_BOX_HEIGHT;
  const messagesEndY = lifelineStartY + ast.messages.length * MESSAGE_ROW_HEIGHT + LIFELINE_START_OFFSET;
  const bottomBoxY = messagesEndY + 1;

  for (const pLayout of layout.participants) {
    drawLifeline(canvas, pLayout, lifelineStartY, messagesEndY, chars);
  }

  for (const message of ast.messages) {
    const fromLayout = layout.participantMap.get(message.from);
    const toLayout = layout.participantMap.get(message.to);

    if (fromLayout && toLayout) {
      const messageY = lifelineStartY + LIFELINE_START_OFFSET + message.index * MESSAGE_ROW_HEIGHT;
      drawMessage(canvas, message, fromLayout, toLayout, messageY, chars);
    }
  }

  for (const pLayout of layout.participants) {
    drawParticipantBox(canvas, pLayout, bottomBoxY);
  }

  return canvas.toString();
}
