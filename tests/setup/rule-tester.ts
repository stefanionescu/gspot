// Runs ESLint rule cases with the declared parsers and shared test callbacks.
import { it, afterAll, describe } from 'bun:test';
import * as parser from '@typescript-eslint/parser';
import { RuleTester, type RuleTesterConfig } from '@typescript-eslint/rule-tester';
import { RULE_TESTER_ROOT, RULE_TESTER_PARSER_OPTIONS } from '#tests/data/test-setup.ts';

RuleTester.afterAll = afterAll;

RuleTester.describe = describe;

RuleTester.it = it;

RuleTester.itSkip = it.skip;

RuleTester.describeSkip = describe.skip;

/**
 * A rule tester using the TypeScript parser and a fixed repository root.
 * @param repositoryRoot folder the rules resolve paths against.
 * @param languageOptions settings for the runtime under test.
 * @returns a tester that runs the ESLint plugin rules.
 */
export function createRuleTester(
    repositoryRoot = RULE_TESTER_ROOT,
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
        settings: { gspot: { root: repositoryRoot } },
    });
}
