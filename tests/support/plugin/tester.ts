// The rule tester every rule test uses: the TypeScript parser, bun's describe and it.
import { resolve } from 'node:path';
import parser from '@typescript-eslint/parser';
import { it, afterAll, describe } from 'bun:test';
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
 * A rule tester using the TypeScript parser and a fixed repository root.
 * @param root the repository root the rules resolve paths against
 * @returns the tester
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Every plugin rule test uses the TypeScript parser and a fixed repository root through this.
export function tester(root = '/repo'): RuleTester {
    return new RuleTester({
        languageOptions: {
            parser,
            parserOptions: {
                // The parser wants an absolute path, which a leading slash is not on Windows; the rules keep the posix root.
                tsconfigRootDir: resolve(root),
                ecmaVersion: 'latest',
                sourceType: 'module',
                ecmaFeatures: { jsx: true },
            },
        },
        settings: { gspot: { root } },
    });
}
