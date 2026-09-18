// The zod schema of the run record, so .gspot/last.json and check --json have a published JSON schema.
import { z } from 'zod';

const JSON_INDENT = 4;

const finding = z.strictObject({
    check: z.string(),
    file: z.string(),
    line: z.number().int().optional(),
    column: z.number().int().optional(),
    rule: z.string().optional(),
    message: z.string(),
    help: z.string().optional(),
    fixable: z.boolean(),
});

const checkResult = z.strictObject({
    id: z.string(),
    scope: z.string(),
    status: z.enum(['ok', 'fail', 'cache', 'missing', 'skipped', 'error']),
    files: z.number().int(),
    duration: z.number(),
    findings: z.array(finding),
    note: z.string().optional(),
    reproduce: z.string().optional(),
    command: z.array(z.string()).optional(),
    baselined: z.number().int(),
});

const baselineVerdict = z.strictObject({
    check: z.string(),
    rule: z.string(),
    count: z.number().int(),
    baseline: z.number().int(),
    held: z.boolean(),
});

const ignoreUse = z.strictObject({
    check: z.string(),
    rule: z.string().optional(),
    paths: z.array(z.string()).optional(),
    reason: z.string(),
    matched: z.number().int(),
});

const skip = z.strictObject({ check: z.string(), source: z.enum(['local', 'flag', 'platform', 'rules']) });

/** The run record as check --json prints it. */
export const recordSchema = z.strictObject({
    version: z.string(),
    stage: z.string(),
    started: z.string(),
    duration: z.number(),
    root: z.string(),
    checks: z.array(checkResult),
    baselines: z.array(baselineVerdict),
    ignores: z.array(ignoreUse),
    skips: z.array(skip),
    inspection: z.strictObject({ checked: z.number().int(), unchecked: z.number().int() }),
    suppressions: z.record(z.string(), z.number().int()),
    unstaged: z.number().int(),
    failed: z.array(z.string()),
    exitCode: z.number().int(),
});

/**
 * The text written to schema/run-record.schema.json.
 * @returns the JSON text
 */
export function recordJsonSchemaText(): string {
    const schema = z.toJSONSchema(recordSchema, { io: 'input' }) as Record<string, unknown>;
    const document = {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        $id: 'https://gspot.dev/schema/run-record.schema.json',
        title: 'gspot run record',
        description:
            'What gspot check --json prints and .gspot/last.json holds: every check with its findings, the baselines, the ignores and the exit code.',
        ...schema,
    };
    return `${JSON.stringify(document, null, JSON_INDENT)}\n`;
}
