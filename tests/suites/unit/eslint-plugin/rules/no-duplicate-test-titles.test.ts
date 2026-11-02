import { join } from 'node:path';
import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester, writePackageFolders } from '#tests/setup/eslint/rule-tester.ts';

const root = writePackageFolders({ mocha: { devDependencies: { mocha: '11.0.0' } }, plain: {} });
const filename = join(root, 'mocha/a.test.ts');

buildRuleTester({ root }).run('no-duplicate-test-titles', plugin.rules['no-duplicate-test-titles'], {
    valid: [
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
    ],
});
