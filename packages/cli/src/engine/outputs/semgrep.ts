import {
    SEMGREP_PARSE_ERRORS,
    SEMGREP_PARSE_EXIT,
    SEMGREP_PARSE_RULE,
    SEMGREP_UNMATCHED_SUPPRESSION,
} from '#cli/config/engine.ts';
import { parseToolOutput } from '#cli/parsers/formats/tool-output.ts';
import { semgrepOutputSchema } from '#cli/schemas/engine.ts';
import { CheckStop } from '#cli/system/errors.ts';
import type { Finding } from '#cli/types/engine/run.ts';
import type { ToolOutput } from '#cli/types/engine/tool-runs.ts';

/**
Read the JSON report of Semgrep. A source parse error is a finding, and any other error stops the check, apart from
the warning about a nosemgrep comment that names another rule than the one that matched: the scan finished, and the
match is in the results.
*/
export function parseSemgrepFindings(output: ToolOutput): Finding[] {
    const { check, stdout } = output;
    const report = parseToolOutput('Semgrep', stdout, semgrepOutputSchema);
    const findings: Finding[] = report.results.map((result) => ({
        check,
        file: result.path,
        line: result.start.line,
        column: result.start.col,
        rule: result.check_id,
        message: result.extra.message,
        fixable: false,
    }));
    for (const error of report.errors) {
        if (SEMGREP_UNMATCHED_SUPPRESSION.test(error.message)) continue;
        const type = typeof error.type === 'string' ? error.type : error.type[0];
        const span = error.spans?.find((each) => each.file === error.path);
        if (span === undefined || error.code !== SEMGREP_PARSE_EXIT || !SEMGREP_PARSE_ERRORS.has(type))
            throw new CheckStop('error', `Semgrep could not complete the scan: ${error.message}`);
        findings.push({
            check,
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
