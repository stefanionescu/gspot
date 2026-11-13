import { parseToolOutput } from '#cli/parsers/formats/tool-output.ts';
import { valeOutputSchema } from '#cli/schemas/engine.ts';
import type { Finding } from '#cli/types/engine/run.ts';
import type { ToolOutput } from '#cli/types/engine/tool-runs.ts';

export function parseValeFindings(output: ToolOutput): Finding[] {
    const { check, stdout } = output;
    return Object.entries(parseToolOutput('Vale', stdout, valeOutputSchema)).flatMap(([file, alerts]) =>
        alerts.map((alert) => ({
            check,
            file,
            line: alert.Line,
            column: alert.Span[0],
            rule: alert.Check,
            message: alert.Message,
            fixable: false,
        })),
    );
}
