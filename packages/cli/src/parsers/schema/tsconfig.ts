import { z } from 'zod';

export const typeScriptConfigSchema = z.looseObject({ compilerOptions: z.record(z.string(), z.unknown()).optional() });
