// Reads markdownlint messages and source locations.
import { z } from 'zod';
import { resolve } from 'node:path';
import { parseReport } from '#cli/runs/output/json.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { MARKDOWNLINT_SEVERITIES } from '#cli/config/runs/output.ts';
import { type ReportInput, type MarkdownlintResult } from '#cli/types/runs/output.ts';

const markdownlintReportSchema = z.array(
    z.object({
        fileName: z.string().min(1),
        lineNumber: z.number().int().positive(),
        ruleNames: z.tuple([z.string().min(1)]).rest(z.string().min(1)),
        ruleDescription: z.string().min(1),
        errorDetail: z.string().nullable(),
        errorContext: z.string().nullable(),
        errorRange: z.tuple([z.number().int().positive(), z.number().int().nonnegative()]).nullable(),
        fixInfo: z.record(z.string(), z.unknown()).nullable(),
        severity: z.enum(MARKDOWNLINT_SEVERITIES),
    } satisfies SchemaShape<MarkdownlintResult[][number]>),
) satisfies z.ZodType<MarkdownlintResult[]>;

/**
 * Read the findings in the markdownlint JSON report.
 *
 * @param input the tool output to read.
 * @returns the findings, with positions and lint rule names resolved against the tool folder.
 */
export function parseMarkdownlintFindings(input: ReportInput): Finding[] {
    const { check, stdout, help, cwd } = input;
    const entries = parseReport('Markdownlint', stdout, markdownlintReportSchema);
    return entries.map((entry) => ({
        check,
        file: resolve(cwd, entry.fileName),
        line: entry.lineNumber,
        ...(entry.errorRange === null ? {} : { column: entry.errorRange[0] }),
        rule: entry.ruleNames[0],
        message: [entry.ruleDescription, entry.errorDetail, entry.errorContext]
            .filter((part) => part !== null)
            .join(': '),
        help,
        fixable: entry.fixInfo !== null,
    }));
}
