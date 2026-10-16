// Reads markdownlint messages and source locations.
import { z } from 'zod';
import { resolve, relative } from 'node:path';
import { toPosix } from '#cli/system/paths.ts';
import { GspotError } from '#cli/system/errors.ts';
import type { SchemaShape } from '#cli/types/objects.ts';
import type { Finding } from '#cli/types/execution/check.ts';
import type { MarkdownlintEntry } from '#cli/types/parsers/output.ts';
import { MARKDOWNLINT_SEVERITIES } from '#cli/config/parsers/output.ts';

// One markdownlint entry as a finding.
function markdownlintFinding(check: string, help: string, entry: MarkdownlintEntry, file: string): Finding {
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
 * @param check the check ID.
 * @param stdout the report.
 * @param help the check's help text.
 * @param root the repository root.
 * @param cwd the directory markdownlint ran in.
 * @returns the findings.
 */
export function markdownlintFindings(
    check: string,
    stdout: string,
    help: string,
    root: string,
    cwd: string,
): Finding[] {
    let entries: MarkdownlintEntry[];
    try {
        entries = markdownlintReportSchema.parse(JSON.parse(stdout));
    } catch (error) {
        throw new GspotError('output', 'Markdownlint returned invalid structured findings.', { cause: error });
    }
    return entries.map((entry) => {
        const file = toPosix(relative(root, resolve(cwd, entry.fileName)));
        return markdownlintFinding(check, help, entry, file);
    });
}
