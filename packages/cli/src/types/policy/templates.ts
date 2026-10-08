import type { z } from 'zod';
import type { templateSchema } from '#cli/policy/schema/templates.ts';

export type TemplateTables = z.infer<typeof templateSchema> & { template: string; selection: 'exact' | 'detect' };

export type Template = { text: string; digest: string; tables: TemplateTables };

export type ExportedTemplate = { text: string; leftOut: string[] };
