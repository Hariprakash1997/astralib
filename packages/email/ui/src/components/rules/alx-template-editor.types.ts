export interface TemplateData {
  _id?: string;
  name: string;
  slug: string;
  category: string;
  audience: string;
  platform: string;
  subjects: string[];
  bodies: string[];
  preheaders: string[];
  fields: Record<string, string>;
  textBody: string;
  variables: string[];
  attachments: Array<{ filename: string; url: string; contentType: string }>;
  isActive: boolean;
}

export const EMPTY_TEMPLATE: TemplateData = {
  name: '',
  slug: '',
  category: '',
  audience: '',
  platform: '',
  subjects: [''],
  bodies: [''],
  preheaders: [],
  fields: {},
  textBody: '',
  variables: [],
  attachments: [],
  isActive: true,
};
