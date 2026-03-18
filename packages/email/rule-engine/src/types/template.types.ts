
export interface EmailAttachment {
  filename: string;
  url: string;
  contentType: string;
}

export interface EmailTemplate {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  category: string;
  audience: string;
  platform: string;

  textBody?: string;
  subjects: string[];
  bodies: string[];
  preheaders?: string[];

  fields?: Record<string, string>;
  variables: string[];
  version: number;
  isActive: boolean;

  attachments?: EmailAttachment[];

  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEmailTemplateInput {
  name: string;
  slug: string;
  description?: string;
  category: string;
  audience: string;
  platform: string;
  textBody?: string;
  subjects: string[];
  bodies: string[];
  preheaders?: string[];
  fields?: Record<string, string>;
  variables?: string[];
  attachments?: EmailAttachment[];
}

export interface UpdateEmailTemplateInput {
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
  attachments?: EmailAttachment[];
  isActive?: boolean;
}
