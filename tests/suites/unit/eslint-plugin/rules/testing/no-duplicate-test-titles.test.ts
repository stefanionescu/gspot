import { join } from 'node:path';
import { buildRuleTester, writePackageFolders } from '#tests/setup/eslint/rule-tester.ts';
import { noDuplicateTestTitles } from '#eslint-plugin/rules/testing/no-duplicate-test-titles.ts';

const root = writePackageFolders({ mocha: { devDependencies: { mocha: '11.0.0' } }, plain: {} });
const filename = join(root, 'mocha/a.test.ts');

buildRuleTester({ root }).run('no-duplicate-test-titles', noDuplicateTestTitles, {
    valid: [
        { code: 'it[mode]("adds", () => {}); it[mode]("adds", () => {});', filename },
        {
            code: 'const tools = require(name);\nit("adds", () => {}); it("adds", () => {});',
            filename: join(root, 'plain/a.test.ts'),
        },
        { code: 'it("adds", () => {}); it("adds", () => {});', filename: join(root, 'plain/a.test.ts') },
        {
            code: 'describe("a", () => { it("adds", () => {}); }); describe("b", () => { it("adds", () => {}); });',
            filename,
        },
        { code: 'it("adds", () => {}); it("removes", () => {});', filename },
        { code: 'describe.skip("a", () => { it("adds", () => {}); it("adds", () => {}); });', filename },
        { code: 'it("adds", () => { it("x", () => {}); }); it("adds2", () => { it("x", () => {}); });', filename },
        { code: 'for (const n of [1, 2]) { it(`adds ${n}`, () => {}); }', filename },
        { code: 'it("adds"); it("adds");', filename, name: 'no callback' },
        { code: '[1, 2].forEach(() => { it("adds", () => {}); });', filename, name: 'inside a callback' },
        {
            code: 'function cases() { it("adds", () => {}); }\ndescribe("a", cases);\ndescribe("b", () => { cases(); });',
            filename,
        },
        { code: 'describe("a", (cases) => { cases(); it("adds", () => {}); });', filename, name: 'a parameter call' },
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
            code: 'describe("cart", () => { describe("list", () => { it("adds", () => {}); it("adds", () => {}); }); });',
            filename,
            errors: [{ messageId: 'duplicate', line: 1 }],
        },
        {
            code: 'describe("cart", () => { if (ready) { it("adds", () => {}); } it("adds", () => {}); });',
            filename,
            errors: [{ messageId: 'duplicate', line: 1 }],
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
            code: 'import { it } from "vitest";\nit("adds", () => {});\nit("adds", () => {});',
            filename: join(root, 'plain/b.test.ts'),
            errors: [{ messageId: 'duplicate', line: 3 }],
        },
        {
            code: 'import { "test" as check } from "vitest";\ncheck("a", () => {});\ncheck("a", () => {});',
            errors: [{ messageId: 'duplicate' }],
        },
        {
            code: 'import { test, describe, beforeEach } from "vitest";\nfunction cases() { describe("x", () => { test("a", () => {}); test("a", () => {}); }); }\ndescribe("y", () => { cases(); });',
            errors: [{ messageId: 'duplicate' }],
        },
        {
            code: 'import { test, describe, beforeEach } from "vitest";\nfunction cases() { run(test("a", () => {}), test("a", () => {})); }\ndescribe("y", () => { cases(); });',
            errors: [{ messageId: 'duplicate' }],
        },
    ],
});
