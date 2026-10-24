import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { PurgecssReport } from '#cli/types/checks/framework/site.ts';

export const purgecssReportSchema = z
    .object({ file: z.string().min(1), rejected: z.string().array() } satisfies SchemaShape<PurgecssReport[number]>)
    .array() satisfies z.ZodType<PurgecssReport>;
