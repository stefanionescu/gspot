import { GspotError } from '#cli/system/errors.ts';
import type { Parsed } from '#cli/types/shapes.ts';
import { buildFinding } from '#cli/runs/finding.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';

/**
Parse a check input and turn a file error into a syntax finding.

@param planned the check that reads the file.
@param path the repository-relative file.
@param parse the parser of the file.
@returns the parsed value or a syntax finding.
*/
export function readParsedFile<Value>(planned: PlannedCheck, path: string, parse: () => Value): Parsed<Value, Finding> {
    try {
        return { value: parse() };
    } catch (error) {
        if (!(error instanceof GspotError) || error.code !== 'filesystem') throw error;
        return { error: buildFinding(planned, { file: path, line: 1 }, 'syntax', error.message) };
    }
}
