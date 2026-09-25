import { z } from 'zod';
import type { Defined } from '#cli/policy/schema.ts';

import { findingSchema, checkResultSchema } from '#cli/checks/result.ts';
import type { Finding, CheckResult } from '#cli/checks/result.ts';

const ignoreUse = z.strictObject({
    check: z.string(),
    rule: z.string().optional(),
    paths: z.array(z.string()).optional(),
    reason: z.string().optional(),
    matched: z.number().int(),
});

const skip = z.strictObject({ check: z.string(), source: z.enum(['flag', 'platform', 'rules', 'ignore']) });

/** The run report as check --json prints it. */
export const reportSchema = z.strictObject({
    comparison: z
        .strictObject({ content: z.enum(['working-tree', 'index', 'commit']), reference: z.string() })
        .optional(),
    version: z.string(),
    stage: z.string(),
    started: z.string(),
    duration: z.number(),
    checks: z.array(checkResultSchema),
    ignores: z.array(ignoreUse),
    skips: z.array(skip),
    coverage: z.strictObject({
        checked: z.number().int().describe('Source files analyzed by checks that ran.'),
        unchecked: z.number().int().describe('Supported source files without an enabled configured check.'),
        findings: z.array(findingSchema).describe('Policy findings produced when strict source coverage is enabled.'),
    }),
    suppressions: z.record(z.string(), z.number().int()),
    unstaged: z.number().int(),
    narrowed: z.boolean(),
    failed: z.array(z.string()),
    exitCode: z.number().int(),
});

/** Reports for every distinct tree and input set supplied by Git's pre-push protocol. */
export const pushReportSchema = z.strictObject({
    canceled: z.strictObject({ pendingRefs: z.array(z.string()) }).optional(),
    revisions: z.array(
        z.strictObject({
            object: z.string(),
            refs: z.array(z.string()),
            commits: z.array(z.string()),
            historyComplete: z.boolean(),
            report: reportSchema,
        }),
    ),
    notApplicable: z.array(
        z.strictObject({ ref: z.string(), object: z.string(), reason: z.enum(['deleted ref', 'non-commit object']) }),
    ),
    exitCode: z.number().int(),
});

export type RunReport = Defined<Omit<z.infer<typeof reportSchema>, 'checks' | 'ignores' | 'coverage'>> & {
    checks: CheckResult[];
    coverage: Omit<z.infer<typeof reportSchema.shape.coverage>, 'findings'> & { findings: Finding[] };
    ignores: Defined<z.infer<typeof reportSchema.shape.ignores.element>>[];
};

export type PushReport = Omit<z.infer<typeof pushReportSchema>, 'revisions'> & {
    revisions: (Omit<z.infer<typeof pushReportSchema.shape.revisions.element>, 'report'> & { report: RunReport })[];
};
