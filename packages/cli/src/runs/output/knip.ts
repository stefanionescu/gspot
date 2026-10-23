import type { Finding } from '#cli/types/runs/check.ts';
import type { ToolOutput } from '#cli/types/runs/output.ts';
import { knipReportSchema } from '#cli/schemas/runs/knip.ts';
import { parseToolReport } from '#cli/parsers/formats/json.ts';
import { KNIP_ISSUE_TYPES, KNIP_ISSUE_MESSAGES } from '#cli/config/runs/output/knip.ts';

/**
 * Read the Knip JSON categories, and keep grouped symbols and source positions.
 *
 * @param output the tool output to read.
 * @returns the findings, with each positioned member of a grouped issue.
 */
export function parseKnipFindings(output: ToolOutput): Finding[] {
    const { check, stdout, help } = output;
    const report = parseToolReport('Knip', stdout, knipReportSchema);
    const findings: Finding[] = [];
    for (const row of report.issues) {
        for (const category of KNIP_ISSUE_TYPES) {
            findings.push(
                ...(row[category] ?? []).flatMap((issue) => {
                    const symbols = Array.isArray(issue) ? issue : [issue];
                    const names = symbols.map(({ name }) => name).join(', ');
                    return symbols.map((symbol) => {
                        const namespace = symbol.namespace === undefined ? '' : ` (${symbol.namespace})`;
                        return {
                            check,
                            file: row.file,
                            rule: category,
                            message: `${KNIP_ISSUE_MESSAGES[category]}: ${names}${namespace}`,
                            help,
                            fixable: false,
                            ...(symbol.line === undefined ? {} : { line: symbol.line }),
                            ...(symbol.col === undefined ? {} : { column: symbol.col }),
                        };
                    });
                }),
            );
        }
    }
    return findings;
}
