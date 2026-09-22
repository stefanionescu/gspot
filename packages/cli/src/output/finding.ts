// Findings and check results derive from the public report schema.
import type { z } from 'zod';
import type { Defined } from '#cli/policy/types.ts';
import type { reportSchema } from '#cli/run/report-schema.ts';

export type Finding = Defined<z.infer<typeof reportSchema.shape.checks.element.shape.findings.element>>;
export type CheckStatus = z.infer<typeof reportSchema.shape.checks.element.shape.status>;
export type CheckResult = Defined<Omit<z.infer<typeof reportSchema.shape.checks.element>, 'findings'>> & {
    findings: Finding[];
};
