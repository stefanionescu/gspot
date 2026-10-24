import type { Finding } from '#cli/types/runs/check.ts';
import type { ToolOutput } from '#cli/types/runs/output.ts';
import { parseRegexFindings } from '#cli/runs/output/text.ts';
import { TAPLO_OUTPUTS } from '#cli/config/runs/output/taplo.ts';

/**
Read Taplo syntax errors and formatting differences with their separate messages.

@param output the tool output to read.
@returns the findings for each reported cause.
*/
export function parseTaploFindings(output: ToolOutput): Finding[] {
    const findings: Finding[] = [];
    for (const format of TAPLO_OUTPUTS) {
        findings.push(...parseRegexFindings({ ...output, output: format }));
    }
    return findings;
}
