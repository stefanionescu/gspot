import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { TypeScriptConfiguration } from '#cli/types/parsers/tsconfig.ts';

export const typeScriptConfigSchema = z.looseObject({
    compilerOptions: z.record(z.string(), z.unknown()).optional(),
} satisfies SchemaShape<Pick<TypeScriptConfiguration['raw'], 'compilerOptions'>>);
