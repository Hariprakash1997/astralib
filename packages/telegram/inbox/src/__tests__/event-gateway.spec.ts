import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InboxEventGateway } from '../services/websocket-gateway';
import type { TypingEvent, MessageReadEvent } from '../services/websocket-gateway';
import type { InboxMessage } from '../types/config.types';

describe('InboxEventGateway', () => {
  let gateway: InboxEventGateway;

  beforeEach(() => {
    gateway = new InboxEventGateway();
  });

  describe('emitNewMessage()', () => {
    it('should emit inbox:new_message event with message data', () => {
      const listener = vi.fn();
      gateway.on('inbox:new_message', listener);

      const message: InboxMessage = {
        conversationId: 'chat-1',
        messageId: 'msg-1',
        senderId: 'user-1',
        senderType: 'user',
        direction: 'inbound',
        contentType: 'text',
        content: 'Hello!',
        createdAt: new Date(),
      };

      gateway.emitNewMessage(message);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(message);
    });
  });

  describe('emitTyping()', () => {
    it('should emit inbox:typing event with chatId and userId', () => {
      const listener = vi.fn();
      gateway.on('inbox:typing', listener);

      gateway.emitTyping('chat-1', 'user-1');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({
        chatId: 'chat-1',
        userId: 'user-1',
      } satisfies TypingEvent);
    });
  });

  describe('emitMessageRead()', () => {
    it('should emit inbox:message_read event with chatId and messageId', () => {
      const listener = vi.fn();
      gateway.on('inbox:message_read', listener);

      gateway.emitMessageRead('chat-1', 'msg-5');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({
        chatId: 'chat-1',
        messageId: 'msg-5',
      } satisfies MessageReadEvent);
    });
  });

  describe('listener subscription', () => {
    it('should allow multiple listeners to subscribe and receive events', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      gateway.on('inbox:new_message', listener1);
      gateway.on('inbox:new_message', listener2);

      const message: InboxMessage = {
        conversationId: 'chat-1',
        messageId: 'msg-1',
        senderId: 'user-1',
        senderType: 'user',
        direction: 'inbound',
        contentType: 'text',
        content: 'Test',
        createdAt: new Date(),
      };

      gateway.emitNewMessage(message);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should not fire listener after removal', () => {
      const listener = vi.fn();
      gateway.on('inbox:typing', listener);
      gateway.removeListener('inbox:typing', listener);

      gateway.emitTyping('chat-1', 'user-1');

      expect(listener).not.toHaveBeenCalled();
    });
  });
});
