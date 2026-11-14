import { join } from 'node:path';
import { noEmptyTestTitles } from '#eslint-plugin/rules/testing/no-empty-test-titles.ts';
import { buildRuleTester, writePackageFolders } from '#tests/setup/eslint/rule-tester.ts';

const root = writePackageFolders({ mocha: { devDependencies: { mocha: '11.0.0' } }, plain: {} });

buildRuleTester({ root }).run('no-empty-test-titles', noEmptyTestTitles, {
    valid: [
        { code: 'it("", run);', filename: join(root, 'plain/a.test.ts'), name: 'no test framework' },
        { code: 'it("adds", () => {});', filename: join(root, 'mocha/a.test.ts') },
        { code: 'it("");', filename: join(root, 'mocha/b.test.ts'), name: 'no callback' },
        { code: 'it.skip("", () => {});', filename: join(root, 'mocha/c.test.ts') },
        { code: 'beforeEach("", () => {});', filename: join(root, 'mocha/e.test.ts') },
        { code: 'it(`${name}`, () => {});', filename: join(root, 'mocha/f.test.ts') },
        { code: 'const it = run;\nit("", () => {});', filename: join(root, 'mocha/g.test.ts'), name: 'local it' },
    ],
    invalid: [
        {
            code: 'describe("", () => { it("  ", () => {}); });',
            filename: join(root, 'mocha/a.test.ts'),
            errors: [
                { messageId: 'empty', column: 10 },
                { messageId: 'empty', column: 25 },
            ],
        },
        {
            code: 'import { test } from "vitest";\ntest.concurrent(``, async () => {});',
            filename: join(root, 'plain/a.test.ts'),
            errors: [{ messageId: 'empty' }],
        },
        {
            code: 'import { test } from "@playwright/test";\ntest.describe.serial("", () => {});',
            filename: join(root, 'plain/b.test.ts'),
            errors: [{ messageId: 'empty' }],
        },
    ],
});
