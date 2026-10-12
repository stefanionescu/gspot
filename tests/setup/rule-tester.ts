// Runs ESLint rule cases with the declared parsers and shared test callbacks.
import { it, afterAll, describe } from 'bun:test';
import * as parser from '@typescript-eslint/parser';
import { RuleTester } from '@typescript-eslint/rule-tester';
import type { RuleTesterConfig } from '@typescript-eslint/rule-tester';
import { RULE_TESTER_ROOT, RULE_TESTER_PARSER_OPTIONS } from '#tests/config/eslint-plugin.ts';

RuleTester.afterAll = afterAll;

RuleTester.describe = describe;

RuleTester.it = it;

RuleTester.itOnly = it.only;

RuleTester.itSkip = it.skip;

RuleTester.describeSkip = describe.skip;

/**
 * A rule tester using the TypeScript parser and a fixed repository root.
 * @param root the repository root the rules resolve paths against.
 * @param languageOptions language settings declared by the tested runtime.
 * @returns the tester.
 */
export function createRuleTester(
    root = RULE_TESTER_ROOT,
    languageOptions: RuleTesterConfig['languageOptions'] = {},
): RuleTester {
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
