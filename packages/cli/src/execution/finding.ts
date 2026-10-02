// The shape of findings and check results, and the one builder every check makes its findings with.
import { z } from 'zod';
import type { Finding, EngineInput, FindingPlace } from '#cli/types/checks.ts';

export const findingSchema = z.strictObject({
    check: z.string(),
    file: z.string(),
    line: z.number().int().optional(),
    column: z.number().int().optional(),
    rule: z.string().optional(),
    message: z.string(),
    help: z.string().optional(),
    fixable: z.boolean(),
});

export const checkResultSchema = z.strictObject({
    check: z.string(),
    scope: z.string(),
    status: z.enum(['ok', 'fail', 'missing', 'skipped', 'error']),
    files: z.number().int(),
    checkedFiles: z
        .array(z.string())
        .optional()
        .describe('Repository-relative files whose analysis was confirmed by the engine.'),
    duration: z.number(),
    findings: z.array(findingSchema),
    note: z.string().optional(),
    reproduce: z.string().optional(),
    command: z.array(z.string()).optional(),
});

/**
 * A finding of a check: it names the check, points at a place, and has no automatic fix.
 * @param input the engine input of the check
 * @param at the file, and the line and column when known
 * @param rule the rule the finding breaks
 * @param text what is wrong
 * @returns the finding
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Every check builds its findings here, so each names its check and none claims an automatic fix.
export function findingAt(input: Pick<EngineInput, 'spec'>, at: FindingPlace, rule: string, text: string): Finding {
    return { check: input.spec.name, ...at, rule, message: text, fixable: false };
}
