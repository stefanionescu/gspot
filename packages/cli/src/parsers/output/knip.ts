import { GspotError } from '#cli/platform/errors.ts';
import { knipReportSchema } from '#cli/parsers/schema/report.ts';
import { KNIP_ISSUE_MESSAGES } from '#cli/config/parsers/output.ts';
import type { Finding, KnipReport } from '#cli/types/parsers/output.ts';

/**
 * Read Knip's JSON categories without losing grouped symbols or source positions.
 * @param check the check ID
 * @param text the native JSON report
 * @param help the check help text
 * @returns categorized findings, including each positioned member of a grouped issue
 */
export function knipFindings(check: string, text: string, help: string): Finding[] {
    let report: KnipReport;
    try {
        report = knipReportSchema.parse(JSON.parse(text));
    } catch (error) {
        throw new GspotError('output', 'Knip returned invalid structured findings.', { cause: error });
    }
    const categories = Object.keys(KNIP_ISSUE_MESSAGES) as (keyof typeof KNIP_ISSUE_MESSAGES)[];
    const findings: Finding[] = [];
    for (const row of report.issues) {
        for (const category of categories) {
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
