import type { z } from 'zod';
import type { toolsSchema } from '#cli/schemas/settings/tools/tables.ts';
import { type IMPORT_EXTENSION_STYLES } from '#cli/config/settings/tools/tables.ts';

export type ImportExtensionStyle = (typeof IMPORT_EXTENSION_STYLES)[number];

export type ParsedTools = z.output<typeof toolsSchema>;
