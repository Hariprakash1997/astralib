import { TemplateCategory, TemplateAudience } from './enums';

export interface EmailTemplate {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  category: TemplateCategory;
  audience: TemplateAudience;
  platform: string;

  subject: string;
  body: string;
  textBody?: string;

  variables: string[];
  version: number;
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEmailTemplateInput {
  name: string;
  slug: string;
  description?: string;
  category: TemplateCategory;
  audience: TemplateAudience;
  platform: string;
  subject: string;
  body: string;
  textBody?: string;
  variables?: string[];
}

export interface UpdateEmailTemplateInput {
  name?: string;
  description?: string;
  category?: TemplateCategory;
  audience?: TemplateAudience;
  platform?: string;
  subject?: string;
  body?: string;
  textBody?: string;
  variables?: string[];
  isActive?: boolean;
}
