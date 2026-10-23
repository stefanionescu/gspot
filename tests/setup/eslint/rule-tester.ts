import { it, afterAll, describe } from 'bun:test';
import * as parser from '@typescript-eslint/parser';
import { RuleTester, type RuleTesterConfig } from '@typescript-eslint/rule-tester';
import { RULE_TESTER_ROOT, RULE_TESTER_PARSER_OPTIONS } from '#tests/config/setup/eslint.ts';

RuleTester.afterAll = afterAll;

RuleTester.describe = describe;

RuleTester.it = it;

RuleTester.itSkip = it.skip;

RuleTester.describeSkip = describe.skip;

/**
 * A rule tester using the TypeScript parser and a fixed repository root.
 *
 * @param options the repository root and language options for the cases.
 * @param options.root the folder the rules resolve paths against.
 * @param options.languageOptions the parser and runtime settings for the cases.
 * @returns a tester that runs the ESLint plugin rules.
 */
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
