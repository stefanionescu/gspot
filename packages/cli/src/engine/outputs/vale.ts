import { valeOutputSchema } from '#cli/schemas/engine.ts';
import { parseToolOutput } from '#cli/parsers/formats/json.ts';
import type { Finding, ToolOutput } from '#cli/types/engine/tool-runs.ts';

/**
Read the JSON that Vale prints: the alerts of each file, keyed by the file path.

@param output the tool output to read.
*/
export function parseValeFindings(output: ToolOutput): Finding[] {
    const { check, help, stdout } = output;
    return Object.entries(parseToolOutput('Vale', stdout, valeOutputSchema)).flatMap(([file, alerts]) =>
        alerts.map((alert) => ({
            check,
            file,
            help,
            line: alert.Line,
            column: alert.Span[0],
            rule: alert.Check,
            message: alert.Message,
            fixable: false,
        })),
    );
}
