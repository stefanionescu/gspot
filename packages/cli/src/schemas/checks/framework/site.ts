import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { PurgecssOutput } from '#cli/types/checks/framework/site.ts';

export const purgecssReportSchema = z
    .object({ file: z.string().min(1), rejected: z.string().array() } satisfies SchemaShape<PurgecssOutput[number]>)
    .array() satisfies z.ZodType<PurgecssOutput>;
