import * as parser from '@typescript-eslint/parser';
import { RuleTester, type RuleTesterConfig } from '@typescript-eslint/rule-tester';
import { RULE_TESTER_ROOT, RULE_TESTER_PARSER_OPTIONS } from '#tests/config/setup/eslint.ts';

/**
A rule tester using the TypeScript parser and a fixed repository root.

@param options the repository root and language options for the cases.
@param options.root the folder the rules resolve paths against.
@param options.languageOptions the parser and runtime settings for the cases.
@returns a tester that runs the ESLint plugin rules.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 14 calls in 11 files share it.
export function createRuleTester({
    root = RULE_TESTER_ROOT,
    languageOptions = {},
}: { root?: string; languageOptions?: RuleTesterConfig['languageOptions'] } = {}): RuleTester {
    return new RuleTester({
        languageOptions: {
            ...languageOptions,
            parser,
            parserOptions: {
                ...RULE_TESTER_PARSER_OPTIONS,
                ...languageOptions.parserOptions,
            },
        },
        settings: { gspot: { root } },
    });
}
