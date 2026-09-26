import { z } from 'zod';

export const findingSchema = z.strictObject({
    check: z.string(),
    engine: z.string().optional(),
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
    status: z.enum(['ok', 'fail', 'cache', 'missing', 'skipped', 'error']),
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

/** A prerequisite prevents this check from running. */
export class SkippedCheckError extends Error {
    /**
     * Names the prerequisite that did not complete.
     * @param text the reason the check cannot run
     */
    constructor(text: string) {
        super(text);
        this.name = 'SkippedCheckError';
    }
}
