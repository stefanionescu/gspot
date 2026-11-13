import { join } from 'node:path';

import { noEarlyTestReturn } from '#eslint-plugin/rules/testing/no-early-test-return.ts';
import { buildRuleTester, writePackageFolders } from '#tests/setup/eslint/rule-tester.ts';

const root = writePackageFolders({
    jestMocha: { devDependencies: { jest: '30.0.0', mocha: '11.0.0' } },
    vitest: { devDependencies: { vitest: '4.0.0' } },
    plain: {},
});

buildRuleTester({ root }).run('no-early-test-return', noEarlyTestReturn, {
    valid: [
        { code: 'it("pays", () => { if (!ready) return; pay(); });', filename: join(root, 'jestMocha/a.test.ts') },
        { code: 'it("pays", () => { if (!ready) return; pay(); });', filename: join(root, 'plain/a.test.ts') },
        {
            code: 'import { it } from "mocha";\nit("pays", function () { if (!ready) { this.skip(); } pay(); });',
            filename: join(root, 'plain/b.test.ts'),
        },
        {
            code: 'import { it } from "mocha";\nit("pays", () => { if (!ready) return; });',
            filename: join(root, 'plain/c.test.ts'),
            name: 'the guard is the whole body',
        },
        {
            code: 'import { it } from "mocha";\nit("pays", () => { if (!ready) return 1; pay(); });',
            filename: join(root, 'plain/d.test.ts'),
        },
        {
            code: 'import { it } from "mocha";\nit("pays", () => { if (!ready) return; else pay(); pay(); });',
            filename: join(root, 'plain/e.test.ts'),
        },
        {
            code: 'import { it } from "mocha";\nit.skip("pays", () => { if (!ready) return; pay(); });',
            filename: join(root, 'plain/f.test.ts'),
        },
        {
            code: 'import { test } from "@playwright/test";\nhelper("pays", () => { if (!ready) return; pay(); });',
            filename: join(root, 'plain/g.test.ts'),
        },
        {
            code: 'import { test } from "@playwright/test";\nit("pays", () => { if (!ready) return; pay(); });',
            filename: join(root, 'plain/h.test.ts'),
        },
    ],
    invalid: [
        {
            code: 'import { it } from "mocha";\nit("pays", function () { if (!ready) return; pay(); });',
            filename: join(root, 'plain/a.test.ts'),
            errors: [{ messageId: 'mocha', line: 2 }],
        },
        {
            code: 'it.only("pays", () => { if (!ready) { return; } pay(); });',
            filename: join(root, 'vitest/a.test.ts'),
            errors: [{ messageId: 'vitest' }],
        },
        {
            code: 'import { test } from "@playwright/test";\ntest("pays", async () => { if (mobile) return; await pay(); });',
            filename: join(root, 'plain/b.test.ts'),
            errors: [{ messageId: 'playwright' }],
        },
        {
            code: 'import test from "node:test";\ntest("pays", (t) => { if (!ready) return; pay(); });',
            filename: join(root, 'plain/c.test.ts'),
            errors: [{ messageId: 'nodeTest' }],
        },
        {
            code: 'import { test } from "bun:test";\ntest("pays", () => { if (!ready) return; pay(); });',
            filename: join(root, 'plain/d.test.ts'),
            errors: [{ messageId: 'bun' }],
        },
    ],
});
