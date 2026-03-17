export interface CreateTelegramTemplateInput {
  name: string;
  messages: string[];
  variables?: string[];
  category?: string;
  platform?: string;
  audience?: string;
  media?: { type: 'photo' | 'video' | 'voice' | 'audio' | 'document'; url: string; caption?: string };
  fields?: Record<string, string>;
}

export interface UpdateTelegramTemplateInput {
  name?: string;
  messages?: string[];
  variables?: string[];
  category?: string;
  platform?: string;
  audience?: string;
  media?: { type: string; url: string; caption?: string } | null;
  fields?: Record<string, string>;
}
