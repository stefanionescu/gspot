import { SYNTAX_RULE } from '#cli/config/configurations/infrastructure.ts';
import { GspotError } from '#cli/system/errors.ts';
import type { CheckFinding } from '#cli/types/engine/run.ts';
import type { Parsed } from '#cli/types/parsers.ts';

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
