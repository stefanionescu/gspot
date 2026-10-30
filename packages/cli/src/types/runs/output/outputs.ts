import type { z } from 'zod';
import type { reportedTypoSchema } from '#cli/schemas/runs/typos.ts';

export type ReportedTypo = z.infer<typeof reportedTypoSchema>;
