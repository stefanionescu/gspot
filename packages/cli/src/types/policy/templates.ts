import type { z } from 'zod';
import type { templateSchema } from '#cli/policy/schema/templates.ts';

export type TemplateTables = z.infer<typeof templateSchema>;

export type Template = { source: string; digest: string; tables: TemplateTables };

export type ExportedTemplate = { text: string; leftOut: string[] };
