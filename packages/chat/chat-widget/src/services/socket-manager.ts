import type { Socket } from 'socket.io-client';
import type {
  ChatMessage,
  ChatAgentInfo,
  ChatSessionSummary,
  ChatSessionStatus,
  ChatContentType,
  ConnectedPayload,
  MessageReceivedPayload,
  MessageStatusPayload,
  TypingPayload,
  StatusPayload,
  ChatErrorPayload,
  VisitorContext,
} from '@astralibx/chat-types';
import {
  VisitorEvent,
  ServerToVisitorEvent,
} from '@astralibx/chat-types';

export interface SocketManagerCallbacks {
  onConnected: (payload: ConnectedPayload) => void;
  onMessage: (payload: MessageReceivedPayload) => void;
  onMessageStatus: (payload: MessageStatusPayload) => void;
  onTyping: (payload: TypingPayload) => void;
  onStatus: (payload: StatusPayload) => void;
  onAgentJoin: (agent: ChatAgentInfo) => void;
  onAgentLeave: () => void;
  onError: (payload: ChatErrorPayload) => void;
  onConnectionChange: (status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting') => void;
}

interface PendingMessage {
  tempId: string;
  resolve: () => void;
  reject: (err: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

const PENDING_TIMEOUT_MS = 30_000;

/**
 * Wraps socket.io-client for the chat widget.
 * Handles connect/disconnect lifecycle, event emission, and reconnection.
 */
export class ChatSocketManager {
  private socket: Socket | null = null;
  private pendingMessages = new Map<string, PendingMessage>();
  private callbacks: SocketManagerCallbacks;
  private socketUrl: string;
  private namespace: string;

  constructor(socketUrl: string, callbacks: SocketManagerCallbacks, namespace = '/chat') {
    this.socketUrl = socketUrl;
    this.callbacks = callbacks;
    this.namespace = namespace;
  }

  async connect(context: VisitorContext, existingSessionId?: string | null): Promise<void> {
    if (this.socket?.connected) return;

    this.callbacks.onConnectionChange('connecting');

    // Dynamic import — socket.io-client is a peer dep
    const { io } = await import('socket.io-client');

    this.socket = io(`${this.socketUrl}${this.namespace}`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
    });

    this.bindEvents();

    // Send connect payload once socket is connected
    this.socket.on('connect', () => {
      this.callbacks.onConnectionChange('connected');
      this.socket!.emit(VisitorEvent.Connect, {
        context,
        existingSessionId: existingSessionId ?? undefined,
      });
    });
  }

  disconnect(): void {
    if (!this.socket) return;

    // Reject all pending messages
    for (const [, pending] of this.pendingMessages) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Socket disconnected'));
    }
    this.pendingMessages.clear();

    this.socket.disconnect();
    this.socket = null;
    this.callbacks.onConnectionChange('disconnected');
  }

  sendMessage(
    content: string,
    contentType: ChatContentType = 'text' as ChatContentType,
    tempId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Not connected'));
        return;
      }

      const timeout = setTimeout(() => {
        this.pendingMessages.delete(tempId);
        reject(new Error('Message send timeout'));
      }, PENDING_TIMEOUT_MS);

      this.pendingMessages.set(tempId, { tempId, resolve, reject, timeout });

      this.socket.emit(VisitorEvent.Message, {
        content,
        contentType,
        tempId,
        metadata,
      });
    });
  }

  sendTyping(isTyping: boolean): void {
    this.socket?.emit(VisitorEvent.Typing, { isTyping });
  }

  sendRead(messageId: string): void {
    this.socket?.emit(VisitorEvent.Read, { messageId });
  }

  sendEscalate(reason?: string): void {
    this.socket?.emit(VisitorEvent.Escalate, { reason });
  }

  sendIdentify(user: { userId?: string; name?: string; email?: string }): void {
    this.socket?.emit(VisitorEvent.Identify, user);
  }

  sendFeedback(rating?: number, survey?: Record<string, unknown>): void {
    this.socket?.emit(VisitorEvent.Feedback, { rating, survey });
  }

  sendPreferences(preferences: Record<string, unknown>): void {
    this.socket?.emit(VisitorEvent.Preferences, preferences);
  }

  sendTrackEvent(event: string, data?: Record<string, unknown>): void {
    this.socket?.emit(VisitorEvent.TrackEvent, { event, data });
  }

  sendPing(): void {
    this.socket?.emit(VisitorEvent.Ping, {});
  }

  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  private bindEvents(): void {
    if (!this.socket) return;

    this.socket.on(ServerToVisitorEvent.Connected, (payload: ConnectedPayload) => {
      this.callbacks.onConnected(payload);
    });

    this.socket.on(ServerToVisitorEvent.Message, (payload: MessageReceivedPayload) => {
      // Resolve pending message if this is a confirmation
      if (payload.tempId && this.pendingMessages.has(payload.tempId)) {
        const pending = this.pendingMessages.get(payload.tempId)!;
        clearTimeout(pending.timeout);
        pending.resolve();
        this.pendingMessages.delete(payload.tempId);
      }
      this.callbacks.onMessage(payload);
    });

    this.socket.on(ServerToVisitorEvent.MessageStatus, (payload: MessageStatusPayload) => {
      this.callbacks.onMessageStatus(payload);
    });

    this.socket.on(ServerToVisitorEvent.Typing, (payload: TypingPayload) => {
      this.callbacks.onTyping(payload);
    });

    this.socket.on(ServerToVisitorEvent.Status, (payload: StatusPayload) => {
      this.callbacks.onStatus(payload);
    });

    this.socket.on(ServerToVisitorEvent.AgentJoin, (agent: ChatAgentInfo) => {
      this.callbacks.onAgentJoin(agent);
    });

    this.socket.on(ServerToVisitorEvent.AgentLeave, () => {
      this.callbacks.onAgentLeave();
    });

    this.socket.on(ServerToVisitorEvent.Error, (payload: ChatErrorPayload) => {
      this.callbacks.onError(payload);
    });

    this.socket.on('disconnect', () => {
      this.callbacks.onConnectionChange('disconnected');
    });

    this.socket.on('reconnect_attempt', () => {
      this.callbacks.onConnectionChange('reconnecting');
    });

    this.socket.on('reconnect', () => {
      this.callbacks.onConnectionChange('connected');
    });
  }
}
