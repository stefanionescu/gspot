import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { ParsedTsconfig } from '#cli/types/parsers/projects/tsconfig.ts';

export const tsconfigSchema = z.looseObject({
    compilerOptions: z.record(z.string(), z.unknown()).optional(),
} satisfies SchemaShape<Pick<ParsedTsconfig['raw'], 'compilerOptions'>>);
