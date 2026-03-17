export enum ChatSessionStatus {
  New = 'new',
  Active = 'active',
  WaitingAgent = 'waiting_agent',
  WithAgent = 'with_agent',
  Resolved = 'resolved',
  Abandoned = 'abandoned',
}

export enum ChatSenderType {
  Visitor = 'visitor',
  Agent = 'agent',
  AI = 'ai',
  System = 'system',
}

export enum ChatContentType {
  Text = 'text',
  Image = 'image',
  File = 'file',
  Card = 'card',
  System = 'system',
}

export enum ChatMessageStatus {
  Sending = 'sending',
  Sent = 'sent',
  Delivered = 'delivered',
  Read = 'read',
  Failed = 'failed',
}

export enum SessionMode {
  AI = 'ai',
  Manual = 'manual',
}

export enum AgentStatus {
  Available = 'available',
  Busy = 'busy',
  Away = 'away',
  Offline = 'offline',
}
