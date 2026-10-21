import { resolve } from 'node:path';
import { parseToolReport } from '#cli/parsers/json.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import type { ToolOutput } from '#cli/types/runs/output.ts';
import { markdownlintReportSchema } from '#cli/schemas/runs/output/markdownlint.ts';

/**
 * Read the findings in the markdownlint JSON report.
 *
 * @param output the tool output to read.
 * @returns the findings, with positions and lint rule names resolved against the tool folder.
 */
export function parseMarkdownlintFindings(output: ToolOutput): Finding[] {
    const { check, stdout, help, cwd } = output;
    const entries = parseToolReport('Markdownlint', stdout, markdownlintReportSchema);
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
