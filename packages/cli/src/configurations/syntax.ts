import { posix } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import type { RuleExplanations } from '#cli/types/tools.ts';
import type { CheckFinding } from '#cli/types/engine/run.ts';
import { findGrammarByExtension } from '#cli/parsers/code/grammars.ts';
import type { Parsed, SqlFile, GrammarName } from '#cli/types/parsers.ts';
import { SYNTAX_RULE, GRAMMAR_CONFIGURATIONS } from '#cli/config/configurations/shared.ts';

export function buildSyntaxFinding(file: string, error: NonNullable<SqlFile['error']>): CheckFinding {
    return { file, line: error.line, column: error.column, rule: SYNTAX_RULE, message: error.text };
}

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

export const SYNTAX_EXPLANATIONS = {
    [SYNTAX_RULE]: {
        description: 'A file that the check reads parses without errors.',
        why: 'The check cannot judge a file that it cannot parse.',
        fix: 'Fix the syntax at the reported line.',
        example: 'A JSON file that ends after `{ "name": "app"` reports `syntax`.',
    },
} as const satisfies RuleExplanations;
