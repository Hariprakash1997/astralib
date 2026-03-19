export interface Attachment {
  filename: string;
  url: string;
  contentType: string;
}

export interface Template {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  category: string;
  audience: string;
  platform: string;
  version: number;
  subjects?: string[];
  bodies: string[];
  preheaders?: string[];
  textBody?: string;
  fields: Record<string, string>;
  variables: string[];
  collectionName?: string;
  joins?: string[];
  attachments?: Attachment[];
  metadata?: Record<string, unknown>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTemplateInput {
  name: string;
  slug: string;
  description?: string;
  category: string;
  audience: string;
  platform: string;
  textBody?: string;
  subjects?: string[];
  bodies: string[];
  preheaders?: string[];
  fields?: Record<string, string>;
  variables?: string[];
  collectionName?: string;
  joins?: string[];
  attachments?: Attachment[];
  metadata?: Record<string, unknown>;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  category?: string;
  audience?: string;
  platform?: string;
  textBody?: string;
  subjects?: string[];
  bodies?: string[];
  preheaders?: string[];
  fields?: Record<string, string>;
  variables?: string[];
  collectionName?: string;
  joins?: string[];
  attachments?: Attachment[];
  metadata?: Record<string, unknown>;
  isActive?: boolean;
}
