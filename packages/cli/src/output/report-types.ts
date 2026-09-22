// The report schema owns both the public document and its parsed types.
import type { z } from 'zod';
import type { Defined } from '#cli/policy/types.ts';
import type { CheckResult } from '#cli/output/finding.ts';
import type { reportSchema, pushReportSchema } from '#cli/run/report-schema.ts';

export type RunReport = Defined<Omit<z.infer<typeof reportSchema>, 'checks' | 'ignores'>> & {
    checks: CheckResult[];
    ignores: Defined<z.infer<typeof reportSchema.shape.ignores.element>>[];
};

export type PushReport = Omit<z.infer<typeof pushReportSchema>, 'revisions'> & {
    revisions: (Omit<z.infer<typeof pushReportSchema.shape.revisions.element>, 'report'> & { report: RunReport })[];
};
