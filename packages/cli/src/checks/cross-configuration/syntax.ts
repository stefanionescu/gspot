import { GspotError } from '#cli/system/errors.ts';
import type { Parsed } from '#cli/types/shapes.ts';
import type { CheckFinding } from '#cli/types/runs/check.ts';
import { SYNTAX_RULE } from '#cli/config/checks/cross-configuration/cross-configuration.ts';

/**
Parse a check input and turn a file error into a syntax finding.

@param path the repository-relative file.
@param parse the parser of the file.
*/
export function parseCheckedFile<Value>(path: string, parse: () => Value): Parsed<Value, CheckFinding> {
    try {
        return { value: parse() };
    } catch (error) {
        if (!(error instanceof GspotError) || error.code !== 'parse') throw error;
        return {
            error: {
                file: path,
                line: 1,
                rule: SYNTAX_RULE,
                message: error.message,
            },
        };
    }
}
