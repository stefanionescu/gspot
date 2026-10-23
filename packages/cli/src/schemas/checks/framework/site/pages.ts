import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { PurgecssReport } from '#cli/types/checks/framework/site.ts';

export const purgecssReportSchema = z.array(
    z.object({ file: z.string().min(1), rejected: z.array(z.string()) } satisfies SchemaShape<PurgecssReport[number]>),
) satisfies z.ZodType<PurgecssReport>;
