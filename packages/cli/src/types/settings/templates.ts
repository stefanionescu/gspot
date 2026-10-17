import type { WrittenSettings } from '#cli/types/settings/file.ts';

export type TemplateTables = Omit<WrittenSettings, 'scope'>;

export type Template = { source: string; text: string; digest: string; tables: TemplateTables };

export type ExportedTemplate = { text: string; leftOut: string[] };
