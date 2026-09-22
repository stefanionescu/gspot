import parser from '@typescript-eslint/parser';
// The rule tester every rule test uses: the TypeScript parser, bun's describe and it.
import { afterAll, describe, it } from 'bun:test';
import { RuleTester } from '@typescript-eslint/rule-tester';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = () => {
    throw new Error('Focused rule tests are not permitted. Run the complete rule suite.');
};
RuleTester.itSkip = it.skip;
RuleTester.describeSkip = describe.skip;

/**
 * A tester for one rule, with the TypeScript parser and a fixed repository root.
 * @param root the repository root the rules resolve paths against
 * @returns the tester
 */
export function tester(root = '/repo'): RuleTester {
    return new RuleTester({
        languageOptions: {
            parser,
            parserOptions: {
                tsconfigRootDir: root,
                ecmaVersion: 'latest',
                sourceType: 'module',
                ecmaFeatures: { jsx: true },
            },
        },
        settings: { gspot: { root } },
    });
}
