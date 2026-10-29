import { resolve } from 'node:path';
import type { Finding } from '#cli/types/runs/check.ts';
import { parseToolOutput } from '#cli/parsers/formats/json.ts';
import type { ToolOutput } from '#cli/types/runs/output/formats.ts';
import { markdownlintOutputSchema } from '#cli/schemas/runs/markdownlint.ts';

/**
Read the findings in the markdownlint JSON report.

@param output the tool output to read.
@returns the findings, with file paths resolved against the tool folder.
*/
export function parseMarkdownlintFindings(output: ToolOutput): Finding[] {
    const { check, stdout, help, cwd } = output;
    const reports = parseToolOutput('Markdownlint', stdout, markdownlintOutputSchema);
    return reports.map((report) => ({
        check,
        file: resolve(cwd, report.fileName),
        line: report.lineNumber,
        ...(report.errorRange !== null && { column: report.errorRange[0] }),
        rule: report.ruleNames[0],
        message: [report.ruleDescription, report.errorDetail, report.errorContext]
            .filter((text) => text !== null)
            .join(': '),
        help,
        fixable: report.fixInfo !== null,
    }));
}
