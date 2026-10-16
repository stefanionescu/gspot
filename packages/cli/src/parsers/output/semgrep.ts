// Reads Semgrep findings and parse errors.
import { z } from 'zod';
import { GspotError } from '#cli/system/errors.ts';
import type { SchemaShape } from '#cli/types/objects.ts';
import type { Finding } from '#cli/types/execution/check.ts';
import type { SemgrepReport } from '#cli/types/parsers/output.ts';
import { SEMGREP_PARSE_EXIT, SEMGREP_PARSE_RULE, SEMGREP_PARSE_ERRORS } from '#cli/config/parsers/output.ts';

const positionSchema = z.object({
    line: z.number().int().positive(),
    col: z.number().int().positive(),
} satisfies SchemaShape<SemgrepReport['results'][number]['start']>);

const semgrepReportSchema = z.object({
    results: z.array(
        z.object({
            check_id: z.string().min(1),
            path: z.string().min(1),
            start: positionSchema,
            extra: z.object({ message: z.string().min(1) } satisfies SchemaShape<
                NonNullable<NonNullable<SemgrepReport['results']>[number]['extra']>
            >),
        } satisfies SchemaShape<NonNullable<SemgrepReport['results']>[number]>),
    ),
    errors: z.array(
        z.object({
            code: z.number().int(),
            type: z.union([z.string(), z.tuple([z.string(), z.unknown()])]) satisfies z.ZodType<
                SemgrepReport['errors'][number]['type']
            >,
            message: z.string().min(1),
            path: z.string().min(1).optional(),
            spans: z
                .array(
                    z.object({ file: z.string().min(1), start: positionSchema } satisfies SchemaShape<
                        NonNullable<SemgrepReport['errors'][number]['spans']>[number]
                    >),
                )
                .optional(),
        } satisfies SchemaShape<SemgrepReport['errors'][number]>),
    ),
} satisfies SchemaShape<SemgrepReport>);

/**
 * Read Semgrep rule findings and source parsing errors without accepting scanner or rule failures.
 * @param check the check ID.
 * @param text the JSON report.
 * @param help the check's correction guidance.
 * @returns positioned diagnostics from a validated report.
 */
export function parseSemgrepFindings(check: string, text: string, help: string): Finding[] {
    let report: SemgrepReport;
    try {
        report = semgrepReportSchema.parse(JSON.parse(text));
    } catch (error) {
        throw new GspotError('output', 'Semgrep returned invalid structured findings.', { cause: error });
    }
    const findings: Finding[] = report.results.map((entry) => ({
        check,
        help,
        file: entry.path,
        line: entry.start.line,
        column: entry.start.col,
        rule: entry.check_id,
        message: entry.extra.message,
        fixable: false,
    }));
    for (const error of report.errors) {
        const type = typeof error.type === 'string' ? error.type : error.type[0];
        const span = error.spans?.find((entry) => entry.file === error.path);
        if (
            error.code !== SEMGREP_PARSE_EXIT ||
            !new Set<string | undefined>(SEMGREP_PARSE_ERRORS).has(type) ||
            span === undefined
        )
            throw new GspotError('output', `Semgrep could not complete the scan: ${error.message}`);
        findings.push({
            check,
            help,
            file: span.file,
            line: span.start.line,
            column: span.start.col,
            rule: SEMGREP_PARSE_RULE,
            message: error.message,
            fixable: false,
        });
    }
    return findings;
}
