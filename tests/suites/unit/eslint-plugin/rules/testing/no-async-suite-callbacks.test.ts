import { join } from 'node:path';

import { noAsyncSuiteCallbacks } from '#eslint-plugin/rules/testing/no-async-suite-callbacks.ts';
import { buildRuleTester, writePackageFolders } from '#tests/setup/eslint/rule-tester.ts';

const root = writePackageFolders({ mocha: { devDependencies: { mocha: '11.0.0' } }, plain: {} });
const filename = join(root, 'mocha/a.test.ts');

buildRuleTester({ root }).run('no-async-suite-callbacks', noAsyncSuiteCallbacks, {
    valid: [
        { code: 'describe("cart", async () => { it("adds", run); });', filename: join(root, 'plain/a.test.ts') },
        { code: 'describe("cart", () => { beforeAll(async () => { await login(); }); it("adds", run); });', filename },
        { code: 'it("adds", async () => { await run(); });', filename },
        {
            code: 'async function setup() { await login(); }\ndescribe("cart", () => { setup(); it("adds", run); });',
            filename,
            name: 'a helper that declares no test',
        },
        {
            code: 'async function declareSuite(cases) { await login(); describe("cart", cases); }',
            filename,
            name: 'a callback that the suite receives as a parameter',
        },
        {
            code: 'import { describe } from "vitest";\ndescribe("cart", async () => { await load(); });',
            filename: join(root, 'plain/b.test.ts'),
        },
    ],
    invalid: [
        {
            code: 'describe("cart", async () => { it("adds", run); });',
            filename,
            errors: [
                {
                    messageId: 'removeAsync',
                    column: 18,
                    suggestions: [
                        { messageId: 'removeAsyncKeyword', output: 'describe("cart", () => { it("adds", run); });' },
                    ],
                },
            ],
        },
        {
            code: 'describe.only("cart", async function () { const user = await login(); it("adds", run); });',
            filename,
            errors: [{ messageId: 'awaitInSuite', column: 56 }],
        },
        {
            code: 'import { describe } from "@jest/globals";\ndescribe("cart", async () => { for await (const row of rows) { it(row, run); } });',
            filename: join(root, 'plain/a.test.ts'),
            errors: [{ messageId: 'awaitInSuite', line: 2 }],
        },
        {
            code: 'async function cases() { await load(); it("adds", run); }\ndescribe("cart", async () => { await cases(); });',
            filename,
            errors: [{ messageId: 'droppingHelper', line: 2, column: 38 }],
        },
        {
            code: 'const cases = async () => { await load(); it("adds", run); };\ndescribe("cart", () => { cases(); });',
            filename,
            errors: [{ messageId: 'droppingHelper', line: 2 }],
        },
        {
            code: 'async function cases() { for await (const row of rows) { it(row, run); } }\ndescribe("cart", () => { cases(); });',
            filename,
            errors: [{ messageId: 'droppingHelper', line: 2 }],
        },
        {
            code: 'async function cases() { await load(); describe("rows", run); }\ndescribe("cart", () => { cases(); });',
            filename,
            errors: [{ messageId: 'droppingHelper', line: 2 }],
        },
        {
            code: 'async function cases() { it("adds", run); }\ndescribe("cart", cases);',
            filename,
            errors: [
                {
                    messageId: 'removeAsync',
                    line: 1,
                    suggestions: [
                        {
                            messageId: 'removeAsyncKeyword',
                            output: 'function cases() { it("adds", run); }\ndescribe("cart", cases);',
                        },
                    ],
                },
            ],
        },
    ],
});
