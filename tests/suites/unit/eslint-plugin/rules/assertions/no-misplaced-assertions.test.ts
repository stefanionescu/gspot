import { join } from 'node:path';
import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester, writePackageFolders } from '#tests/setup/eslint/rule-tester.ts';

const root = writePackageFolders({ jest: { devDependencies: { jest: '30.0.0' } } });

buildRuleTester({ root }).run('no-misplaced-assertions', plugin.rules['no-misplaced-assertions'], {
    valid: [
        'describe("cart", () => { expect(cart.items).toHaveLength(0); });',
        'import { expect } from "chai";\ndescribe("cart", () => { it("is empty", () => { expect(cart.items).to.be.empty; }); });',
        'import { expect } from "chai";\ndescribe("cart", () => { beforeEach(() => { expect(cart).to.exist; }); });',
        'import { expect } from "chai";\ndescribe("cart", () => { const check = () => expect(cart).to.exist; });',
        'import assert from "node:assert";\nassert.equal(add(1, 2), 3);',
        'import { expect } from "chai";\nexpect(add(1, 2)).to.equal(3);',
        'import { expect } from "vitest";\nexpectTypeOf(add).toBeFunction();',
        'import { expectTypeOf } from "vitest";\ndescribe("add", () => { expectTypeOf(add).toBeFunction(); });',
    ],
    invalid: [
        {
            code: 'import { describe, expect } from "vitest";\ndescribe("cart", () => {\n    expect(cart.items).toHaveLength(0);\n});',
            errors: [{ messageId: 'misplaced', line: 3, column: 5 }],
        },
        {
            code: 'import { expect } from "chai";\ndescribe("cart", function () { expect(cart).to.exist; });',
            errors: [{ messageId: 'misplaced' }],
        },
        {
            code: 'import assert from "node:assert";\nassert.equal(add(1, 2), 3);\nit("adds", () => {});',
            errors: [{ messageId: 'misplaced', line: 2 }],
        },
        {
            code: 'import { expect } from "vitest";\nexpect(add(1, 2)).toBe(3);',
            errors: [{ messageId: 'misplaced', line: 2 }],
        },
        {
            code: 'import { test, expect } from "@playwright/test";\ntest.describe("cart", () => { expect(page).toBeDefined(); });',
            errors: [{ messageId: 'misplaced' }],
        },
        {
            code: 'expect(add(1, 2)).toBe(3);',
            filename: join(root, 'jest/a.test.ts'),
            errors: [{ messageId: 'misplaced' }],
        },
    ],
});
