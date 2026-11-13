import { posix } from 'node:path';

import { GRAMMAR_CONFIGURATIONS, SYNTAX_RULE } from '#cli/config/configurations/shared.ts';
import { findGrammarByExtension } from '#cli/parsers/code/grammars.ts';
import { GspotError } from '#cli/system/errors.ts';
import type { CheckFinding } from '#cli/types/engine/run.ts';
import type { GrammarName, Parsed } from '#cli/types/parsers.ts';

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

export function selectGrammar(path: string, language: string): GrammarName | undefined {
    if (!GRAMMAR_CONFIGURATIONS.has(language)) return undefined;
    if (language === 'bash' && posix.extname(path) === '') return 'bash';
    const found = findGrammarByExtension(path);
    return found === language || (language === 'typescript' && found === 'tsx') ? found : undefined;
}
