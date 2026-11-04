import { join } from 'node:path';
import { buildRuleTester, writePackageFolders } from '#tests/setup/eslint/rule-tester.ts';
import { noDuplicateTestRows } from '#eslint-plugin/rules/testing/no-duplicate-test-rows.ts';

const root = writePackageFolders({ jest: { devDependencies: { jest: '30.0.0' } }, plain: {} });
const filename = join(root, 'jest/a.test.ts');

buildRuleTester({ root }).run('no-duplicate-test-rows', noDuplicateTestRows, {
    valid: [
        { code: 'test.each([1, 1])("adds %d", () => {});', filename: join(root, 'plain/a.test.ts') },
        { code: 'test.each([1, 2, "1"])("adds %d", () => {});', filename },
        { code: 'test.each([...rows, ...rows])("adds %d", () => {});', filename },
    ],
    invalid: [
        {
            code: 'test.each([1, 2, 1, 3, 2])("adds %d", () => {});',
            filename,
            output: 'test.each([1, 2, 3])("adds %d", () => {});',
            errors: [
                { messageId: 'duplicate', column: 18 },
                { messageId: 'duplicate', column: 24 },
            ],
        },
        {
            code: 'import { it } from "bun:test";\nit.each([{ a: 1 }, { a: 1 }])("adds", () => {});',
            filename: join(root, 'plain/a.test.ts'),
            output: 'import { it } from "bun:test";\nit.each([{ a: 1 }])("adds", () => {});',
            errors: [{ messageId: 'duplicate', line: 2 }],
        },
    ],
});
