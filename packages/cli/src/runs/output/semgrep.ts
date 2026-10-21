// Reads Semgrep findings and parse errors.
import { parseReport } from '#cli/parsers/json.ts';
import { GspotError } from '#cli/system/errors.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { type ReportInput } from '#cli/types/runs/output.ts';
import { semgrepReportSchema } from '#cli/schemas/runs/output/semgrep.ts';
import { SEMGREP_PARSE_EXIT, SEMGREP_PARSE_RULE, SEMGREP_PARSE_ERRORS } from '#cli/config/runs/output.ts';

/**
 * Read Semgrep rule findings and source parsing errors, and refuse scanner or rule failures.
 *
 * @param input the tool output to read.
 * @returns positioned findings from a validated report.
 */
export function parseSemgrepFindings(input: ReportInput): Finding[] {
    const { check, stdout: text, help } = input;
    const report = parseReport('Semgrep', text, semgrepReportSchema);
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
        if (error.code !== SEMGREP_PARSE_EXIT || !SEMGREP_PARSE_ERRORS.has(type) || span === undefined)
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
