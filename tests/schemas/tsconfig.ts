import { z } from 'zod';
import type { Tsconfig } from '#tests/types/tools.ts';
import type { SchemaShape } from '#cli/types/shapes.ts';

export const tsconfigSchema = z.object({
    extends: z.string().optional(),
    include: z.string().array().optional(),
    exclude: z.string().array().optional(),
    compilerOptions: z
        .object({ typeRoots: z.string().array().optional() } satisfies SchemaShape<
            NonNullable<Tsconfig['compilerOptions']>
        >)
        .optional(),
} satisfies SchemaShape<Tsconfig>);
