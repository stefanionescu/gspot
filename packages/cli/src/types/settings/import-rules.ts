import type { z } from 'zod';
import type { importRulesSchema } from '#cli/schemas/settings/import-rules.ts';

export type ImportRule = z.output<typeof importRulesSchema>[number];
