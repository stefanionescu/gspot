import { join } from 'node:path';
import { noEmptyTestTable } from '#eslint-plugin/rules/testing/no-empty-test-table.ts';
import { buildRuleTester, writePackageFolders } from '#tests/setup/eslint/rule-tester.ts';

const root = writePackageFolders({ jest: { devDependencies: { jest: '30.0.0' } }, plain: {} });
const filename = join(root, 'jest/a.test.ts');

buildRuleTester({ root }).run('no-empty-test-table', noEmptyTestTable, {
    valid: [
        { code: 'test.each([])("adds %d", () => {});', filename: join(root, 'plain/a.test.ts') },
        { code: 'test.each([1])("adds %d", () => {});', filename },
        { code: 'test.each([])("adds %d");', filename, name: 'no callback' },
        { code: 'const rows = [];\nrows.push(1);\ntest.each(rows)("adds %d", () => {});', filename },
        { code: 'let rows = [];\nrows = [1];\ntest.each(rows)("adds %d", () => {});', filename },
        { code: 'test.skip.each([])("adds %d", () => {});', filename },
        { code: 'other.each([])("adds %d", () => {});', filename },
    ],
    invalid: [
        { code: 'test.each([])("adds %d", () => {});', filename, errors: [{ messageId: 'empty', column: 11 }] },
        {
            code: 'const rows: number[] = [];\nit.only.each(rows)("adds %d", () => {});',
            filename,
            errors: [{ messageId: 'empty', line: 2 }],
        },
        {
            code: 'import { describe } from "vitest";\nfunction run() {}\ndescribe.each([] as const)("cart %s", run);',
            filename: join(root, 'plain/a.test.ts'),
            errors: [{ messageId: 'empty', line: 3 }],
        },
    ],
});
