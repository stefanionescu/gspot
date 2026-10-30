import { GspotError } from '#cli/system/errors.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import type { ToolOutput } from '#cli/types/runs/output.ts';
import { parseToolOutput } from '#cli/parsers/formats/json.ts';
import { semgrepOutputSchema } from '#cli/schemas/runs/semgrep.ts';
import { SEMGREP_PARSE_RULE, SEMGREP_PARSE_EXIT, SEMGREP_PARSE_ERRORS } from '#cli/config/runs/output.ts';

/**
Read Semgrep rule findings and source parsing errors, and refuse scanner or rule failures.

@param output the tool output to read.
*/
export function parseSemgrepFindings(output: ToolOutput): Finding[] {
    const { check, stdout, help } = output;
    const report = parseToolOutput('Semgrep', stdout, semgrepOutputSchema);
    const findings: Finding[] = report.results.map((result) => ({
        check,
        help,
        file: result.path,
        line: result.start.line,
        column: result.start.col,
        rule: result.check_id,
        message: result.extra.message,
        fixable: false,
    }));
    for (const error of report.errors) {
        const type = typeof error.type === 'string' ? error.type : error.type[0];
        const span = error.spans?.find((each) => each.file === error.path);
        if (span === undefined || error.code !== SEMGREP_PARSE_EXIT || !SEMGREP_PARSE_ERRORS.has(type))
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
