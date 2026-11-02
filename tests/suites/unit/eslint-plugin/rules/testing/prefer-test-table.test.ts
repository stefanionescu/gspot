import { join } from 'node:path';
import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester, writePackageFolders } from '#tests/setup/eslint/rule-tester.ts';

const root = writePackageFolders({
    jest: { devDependencies: { jest: '30.0.0' } },
    mocha: { devDependencies: { mocha: '11.0.0' } },
    plain: {},
});
const filename = join(root, 'jest/a.test.ts');
buildRuleTester({ root }).run('prefer-test-table', plugin.rules['prefer-test-table'], {
    valid: [
        {
            code: 'test("adds", () => { const total = double(1); expect(total).toBeGreaterThan(0); });\ntest("adds more", () => { const total = double(2); expect(total).toBeGreaterThan(0); });\ntest("adds again", () => { const total = double(3); expect(total).toBeGreaterThan(0); });',
            filename: join(root, 'mocha/a.test.ts'),
        },
        {
            code: 'test("adds", () => { const total = double(1); expect(total).toBeGreaterThan(0); });\ntest("adds more", () => { const total = double(2); expect(total).toBeGreaterThan(0); });',
            filename,
            name: 'two copies',
        },
        {
            code:
                'test("adds", () => { const total = double(1); expect(total).toBeGreaterThan(0); });\ntest("adds more", () => { const total = double(2); expect(total).toBeGreaterThan(0); });' +
                '\ntest("adds", () => { const total = halve(1); expect(total).toBeGreaterThan(0); });',
            filename,
            name: 'one body calls another function',
        },
        {
            code: 'test("a", () => { run(1); });\ntest("b", () => { run(2); });\ntest("c", () => { run(3); });',
            filename,
            name: 'one statement',
        },
        {
            code: 'test("a", () => run(1));\ntest("b", () => run(2));\ntest("c", () => run(3));',
            filename,
            name: 'bodies without a block',
        },
        {
            code: 'test.skip("adds", () => { const total = double(1); expect(total).toBeGreaterThan(0); });\ntest.skip("adds more", () => { const total = double(2); expect(total).toBeGreaterThan(0); });\ntest.skip("adds most", () => { const total = double(3); expect(total).toBeGreaterThan(0); });',
            filename,
            name: 'skipped tests',
        },
        {
            code:
                'import { describe } from "mocha";\n' +
                'test("adds", () => { const total = double(1); expect(total).toBeGreaterThan(0); });\ntest("adds more", () => { const total = double(2); expect(total).toBeGreaterThan(0); });\ntest("adds again", () => { const total = double(3); expect(total).toBeGreaterThan(0); });',
            filename,
            name: 'Mocha imports turn off the global tests',
        },
    ],
    invalid: [
        {
            code: 'test("adds", () => { const total = double(1); expect(total).toBeGreaterThan(0); });\ntest("adds more", () => { const total = double(2); expect(total).toBeGreaterThan(0); });\ntest("adds again", () => { const total = double(3); expect(total).toBeGreaterThan(0); });',
            filename,
            errors: [{ messageId: 'table', data: { count: '3' }, line: 1, column: 6 }],
        },
        {
            code: `import { it as test } from "vitest";\ndescribe("math", () => {\ntest("adds", () => { const total = double(1); expect(total).toBeGreaterThan(0); });\ntest("adds more", () => { const total = double(2); expect(total).toBeGreaterThan(0); });\ntest("adds again", () => { const total = double(3); expect(total).toBeGreaterThan(0); });\ntest("adds most", () => { const total = double(4); expect(total).toBeGreaterThan(0); });\n});`,
            filename: join(root, 'plain/a.test.ts'),
            errors: [{ messageId: 'table', data: { count: '4' }, line: 3 }],
        },
    ],
});
