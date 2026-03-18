import { EventEmitter } from 'events';
import type { InboxMessage } from '../types/config.types';

export interface TypingEvent {
  chatId: string;
  userId: string;
}

export interface MessageReadEvent {
  chatId: string;
  messageId: string;
}

export class InboxEventGateway extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }

  emitNewMessage(message: InboxMessage): void {
    this.emit('inbox:new_message', message);
  }

  emitTyping(chatId: string, userId: string): void {
    this.emit('inbox:typing', { chatId, userId } satisfies TypingEvent);
  }

  emitMessageRead(chatId: string, messageId: string): void {
    this.emit('inbox:message_read', { chatId, messageId } satisfies MessageReadEvent);
  }
}
