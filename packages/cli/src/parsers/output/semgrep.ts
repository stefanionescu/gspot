import { GspotError } from '#cli/platform/errors.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { SemgrepReport } from '#cli/types/parsers/semgrep.ts';
import { SEMGREP_PARSE_EXIT } from '#cli/config/parsers/output.ts';
import { semgrepReportSchema } from '#cli/parsers/schema/semgrep.ts';

/**
 * Read Semgrep rule findings and source parsing errors without accepting scanner or rule failures.
 * @param check the check name
 * @param text the native JSON report
 * @param help the check's correction guidance
 * @returns positioned diagnostics from a validated native report
 */
export function semgrepFindings(check: string, text: string, help: string): Finding[] {
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
        if (error.code !== SEMGREP_PARSE_EXIT || !['ParseError', 'PartialParsing'].includes(type) || span === undefined)
            throw new GspotError('output', `Semgrep could not complete the scan: ${error.message}`);
        findings.push({
            check,
            help,
            file: span.file,
            line: span.start.line,
            column: span.start.col,
            rule: 'parse-error',
            message: error.message,
            fixable: false,
        });
    }
    return findings;
}
