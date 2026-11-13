import { join } from 'node:path';

import { noDuplicateTestTitles } from '#eslint-plugin/rules/testing/no-duplicate-test-titles.ts';
import { buildRuleTester, writePackageFolders } from '#tests/setup/eslint/rule-tester.ts';

const root = writePackageFolders({ mocha: { devDependencies: { mocha: '11.0.0' } }, plain: {} });
const filename = join(root, 'mocha/a.test.ts');

buildRuleTester({ root }).run('no-duplicate-test-titles', noDuplicateTestTitles, {
    valid: [
        { code: 'it[mode]("adds", () => {}); it[mode]("adds", () => {});', filename },
        { code: 'it("adds", () => {}); it("adds", () => {});', filename: join(root, 'plain/a.test.ts') },
        {
            code: 'describe("a", () => { it("adds", () => {}); }); describe("b", () => { it("adds", () => {}); });',
            filename,
        },
        { code: 'it("adds", () => {}); it("removes", () => {});', filename },
        { code: 'describe.skip("a", () => { it("adds", () => {}); it("adds", () => {}); });', filename },
        { code: 'it(`adds ${first}`, () => {}); it(`adds ${second}`, () => {});', filename },
        {
            code: 'describe("cart", () => { describe("a", () => { it("adds", () => {}); }); describe("b", () => { it("adds", () => {}); }); });',
            filename,
        },
        {
            code: 'function cases() { it("adds", () => {}); cases(); }\ndescribe("cart", () => { cases(); });',
            filename,
        },
        { code: 'it("adds"); it("adds");', filename, name: 'no callback' },
    ],
    invalid: [
        ...[
            'const { it } = require("vitest");\nit("adds", () => {}); it("adds", () => {});',
            'const it = require("vitest").it;\nit("adds", () => {}); it("adds", () => {});',
            'const test = require("node:test");\ntest("adds", () => {}); test("adds", () => {});',
        ].map((code) => ({
            code,
            filename: join(root, 'plain/a.test.ts'),
            errors: [{ messageId: 'duplicate' as const, line: 2 }],
        })),
        {
            code: 'const { it } = require("vitest");\nit("adds", () => {}); it("adds", () => {});',
            filename: join(root, 'plain/a.test.ts'),
            languageOptions: { globals: { require: 'readonly' } },
            errors: [{ messageId: 'duplicate', line: 2 }],
        },
        {
            code: 'it("adds", () => {}); it("adds", () => {}); it("adds", () => {});',
            filename,
            errors: [
                { messageId: 'duplicate', column: 26 },
                { messageId: 'duplicate', column: 48 },
            ],
        },
        {
            code: 'describe("cart", () => { test(`adds`, () => {}); test.only("adds", () => {}); });',
            filename,
            errors: [{ messageId: 'duplicate' }],
        },
        {
            code: 'function cases() { it("adds", () => {}); }\ndescribe("cart", () => { it("adds", () => {}); cases(); });',
            filename,
            errors: [{ messageId: 'duplicate', line: 1 }],
        },
        {
            code: 'import { "test" as check } from "vitest";\ncheck("a", () => {});\ncheck("a", () => {});',
            errors: [{ messageId: 'duplicate' }],
        },
        {
            code: 'import { test, describe } from "vitest";\nfunction cases() { describe("x", () => { test("a", () => {}); test("a", () => {}); }); }\ndescribe("y", () => { cases(); });',
            errors: [{ messageId: 'duplicate' }],
        },
        {
            code: 'import { test, describe } from "vitest";\nfunction cases() { run(test("a", () => {}), test("a", () => {})); }\ndescribe("y", () => { cases(); });',
            errors: [{ messageId: 'duplicate' }],
        },
    ],
});
