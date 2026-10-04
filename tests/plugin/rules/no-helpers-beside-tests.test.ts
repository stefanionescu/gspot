import { testdir } from 'testdirs';
import { afterAll } from 'bun:test';
import { createRuleTester } from '#tests/harness/rule-tester.ts';
import { noHelpersBesideTests } from '#plugin/rules/no-helpers-beside-tests.ts';

import {
    OPTIONS,
    TEST_FILES,
    HARNESS_SOURCES,
    ASSERTION_SOURCES,
} from '#tests/config/plugin/rules/no-helpers-beside-tests.ts';

const directory = await testdir(TEST_FILES);
const root = directory.path;
afterAll(() => directory[Symbol.asyncDispose]());

createRuleTester(root).run('no-helpers-beside-tests', noHelpersBesideTests, {
    valid: [
        ...ASSERTION_SOURCES.map((code) => ({ code, filename: `${root}/tests/unit/builders.ts`, options: OPTIONS })),
        { code: '', filename: `${root}/tests/custom/factory.ts`, options: [{ harness: 'tests/custom' }] },
        { code: '', filename: `${root}/tests/unit/a.test.ts`, options: OPTIONS },
        { code: '', filename: `${root}/tests/unit/b.d.ts`, options: OPTIONS },
        { code: '', filename: `${root}/tests/support/factory.ts`, options: OPTIONS },
        { code: '', filename: `${root}/tests/only/one.ts`, options: OPTIONS },
        { code: '', filename: `${root}/tests/declarations/one.ts`, options: OPTIONS },
        { code: '', filename: `${root}/tests/folders/builders.ts`, options: OPTIONS },
        { code: '', filename: `${root}/tests/custom-pattern/a.check.ts`, options: OPTIONS },
        { code: '', filename: `${root}/tests/custom-pattern/builders.ts`, options: OPTIONS },
        { code: '', filename: `${root}/src/a.ts`, options: OPTIONS },
        // With no harness named, there is no folder to send a support file to, so the rule reports nothing.
        { code: '', filename: `${root}/tests/unit/builders.ts` },
    ],
    invalid: [
        ...HARNESS_SOURCES.map((code) => ({
            code,
            filename: `${root}/tests/unit/builders.ts`,
            options: OPTIONS,
            errors: [{ messageId: 'misplaced' as const, data: { name: 'builders.ts', harness: 'tests/support' } }],
        })),
        ...['tests/mocks/factory.ts', 'tests/custom/factory.ts', 'tests/unit/builders.ts'].map((path) => ({
            code: '',
            filename: `${root}/${path}`,
            options: OPTIONS,
            errors: [
                { messageId: 'misplaced' as const, data: { name: path.split('/').at(-1)!, harness: 'tests/support' } },
            ],
        })),
    ],
});
