import { join } from 'node:path';

import { noUnexplainedTestSkips } from '#eslint-plugin/rules/testing/no-unexplained-test-skips.ts';
import { buildRuleTester, writePackageFolders } from '#tests/setup/eslint/rule-tester.ts';

const root = writePackageFolders({
    jasmine: { devDependencies: { jasmine: '5.0.0' } },
    jest: { devDependencies: { jest: '30.0.0' } },
    vitest: { devDependencies: { vitest: '4.0.0' } },
    mocha: { devDependencies: { mocha: '11.0.0' } },
    playwright: { devDependencies: { '@playwright/test': '1.50.0' } },
    jestPlaywright: { devDependencies: { jest: '30.0.0', '@playwright/test': '1.50.0' } },
    node: {},
});

buildRuleTester({ root }).run('no-unexplained-test-skips', noUnexplainedTestSkips, {
    valid: [
        { code: 'it.skip("adds", run);', filename: join(root, 'other.test.ts') },
        { code: '// Waits for the tax table.\nit.skip("adds", run);', filename: join(root, 'jest/a.test.ts') },
        { code: 'it.skip("adds", run); // Flaky on CI.', filename: join(root, 'mocha/a.test.ts') },
        { code: 'xtest("adds", run);', filename: join(root, 'vitest/a.test.ts') },
        { code: 'it.skip("adds", run);', filename: join(root, 'jasmine/a.test.ts') },
        { code: 'test.skip(isMobile, "no touch");', filename: join(root, 'playwright/a.test.ts'), name: 'conditional' },
        { code: 'test("adds", (t) => { t.skip("no network"); });', filename: join(root, 'node/a.test.ts') },
        { code: 'test("adds", { skip: false }, run);', filename: join(root, 'node/b.test.ts') },
        { code: 'test("adds", (t) => { t.todo(); });', filename: join(root, 'node/c.test.ts') },
        { code: 'test("adds", ({ skip }) => { run(); });', filename: join(root, 'node/d.test.ts') },
        { code: 'test("adds", (t) => { run(t); });', filename: join(root, 'node/e.test.ts') },
        { code: 'run("adds", (t) => { t.skip(); });', filename: join(root, 'node/f.test.ts') },
        { code: 'it.only("adds", run);', filename: join(root, 'jest/b.test.ts') },
        { code: 'it.skip("adds", run);\n// Waits for the tax table.', filename: join(root, 'jest/c.test.ts') },
        {
            code: 'import { test } from "@playwright/test";\ntest.skip(isMobile, "no touch");',
            filename: join(root, 'jestPlaywright/a.test.ts'),
            name: 'the import names the framework',
        },
    ],
    invalid: [
        {
            code: 'xit("adds", run);',
            filename: join(root, 'jasmine/a.test.ts'),
            errors: [{ messageId: 'skipped' }],
        },
        { code: 'test.skip("a", run);', filename: join(root, 'jest/a.test.ts'), errors: [{ messageId: 'skipped' }] },
        {
            code: '//\nit.skip("adds", run);',
            filename: join(root, 'vitest/b.test.ts'),
            name: 'a comment without a letter',
            errors: [{ messageId: 'skipped' }],
        },
        {
            code: '// Waits for the tax table.\n\nit.skip("adds", run);',
            filename: join(root, 'mocha/a.test.ts'),
            errors: [{ messageId: 'skipped', line: 3 }],
        },
        {
            code: 'test.skip("adds", run);\ntest.describe.serial.skip("cart", run);',
            filename: join(root, 'playwright/a.test.ts'),
            errors: [{ messageId: 'skipped' }, { messageId: 'skipped' }],
        },
        {
            code: 'import { test } from "@playwright/test";\ntest.describe.skip("cart", run);',
            filename: join(root, 'jestPlaywright/b.test.ts'),
            errors: [{ messageId: 'skipped' }],
        },
        {
            code: 'test("adds", (t) => { t.skip(); });',
            filename: join(root, 'node/a.test.ts'),
            errors: [{ messageId: 'skipped', column: 23 }],
        },
        {
            code: 'import test from "node:test";\ntest("adds", (t) => { t.skip(); });',
            filename: join(root, 'jest/d.test.ts'),
            errors: [{ messageId: 'skipped', line: 2 }],
        },
        {
            code: 'import test from "node:test";\nconst options = { skip: true };\ntest("adds", options, run);\ntest("b", { skip: "" }, run);',
            filename: join(root, 'node/b.test.ts'),
            errors: [
                { messageId: 'skipped', line: 2 },
                { messageId: 'skipped', line: 4 },
            ],
        },
    ],
});
