// Reads markdownlint messages and source locations.
import { resolve } from 'node:path';
import { parseReport } from '#cli/parsers/json.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { type ReportInput } from '#cli/types/runs/output.ts';
import { markdownlintReportSchema } from '#cli/schemas/runs/output/markdownlint.ts';

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
