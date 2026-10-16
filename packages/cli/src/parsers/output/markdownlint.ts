// Reads markdownlint messages and source locations.
import { z } from 'zod';
import { resolve } from 'node:path';
import type { SchemaShape } from '#cli/types/objects.ts';
// eslint-disable-next-line import-x/no-cycle -- reason: The required format table calls this hoisted reader, and owns the shared report parser.
import { parseReport } from '#cli/parsers/output/formats.ts';
import type { Finding } from '#cli/types/execution/check.ts';
import { MARKDOWNLINT_SEVERITIES } from '#cli/config/parsers/output.ts';
import { type ReportInput, type MarkdownlintEntry } from '#cli/types/parsers/output.ts';

// One markdownlint entry as a finding.
function buildFinding(check: string, help: string, entry: MarkdownlintEntry, file: string): Finding {
    return {
        check,
        file,
        line: entry.lineNumber,
        ...(entry.errorRange === null ? {} : { column: entry.errorRange[0] }),
        rule: entry.ruleNames[0],
        message: [entry.ruleDescription, entry.errorDetail, entry.errorContext]
            .filter((part) => part !== null)
            .join(': '),
        help,
        fixable: entry.fixInfo !== null,
    };
}

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
    } satisfies SchemaShape<MarkdownlintEntry[][number]>),
) satisfies z.ZodType<MarkdownlintEntry[]>;

/**
 * Findings from the markdownlint JSON report, with its reported source position.
 * @param input the check, report text, source paths, and output declaration.
 * @returns the findings.
 */
export function parseMarkdownlintFindings(input: ReportInput): Finding[] {
    const { check, stdout, help, cwd } = input;
    const entries = parseReport('Markdownlint', stdout, markdownlintReportSchema);
    return entries.map((entry) => {
        const file = resolve(cwd, entry.fileName);
        return buildFinding(check, help, entry, file);
    });
}
