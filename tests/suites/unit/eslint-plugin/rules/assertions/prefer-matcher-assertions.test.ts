import { join } from 'node:path';
import { buildRuleTester, writePackageFolders } from '#tests/setup/eslint/rule-tester.ts';
import { preferMatcherAssertions } from '#eslint-plugin/rules/assertions/prefer-matcher-assertions.ts';

const root = writePackageFolders({
    cypress: { devDependencies: { cypress: '15.0.0' } },
    jasmine: { devDependencies: { 'jasmine-core': '^5.1.0' } },
    early: { devDependencies: { 'jasmine-core': '~3.5.0' } },
    major: { devDependencies: { 'jasmine-core': '^3' } },
    capped: { devDependencies: { 'jasmine-core': '<4' } },
});

buildRuleTester({ root }).run('prefer-matcher-assertions', preferMatcherAssertions, {
    valid: [
        'import { expect } from "vitest";\nexpect(value).toBe(1);',
        'import { expect } from "vitest";\nexpect(left > right).toBe(true);',
        'import { expect } from "vitest";\nexpect(name.includes("a")).toBe(true);',
        'import { expect } from "vitest";\nexpect(await page.locator("a").isVisible()).toBe(true);',
        'import { expect } from "@playwright/test";\nexpect(await other.isVisible()).toBe(true);',
        'import { expect } from "@playwright/test";\nexpect(await load().isVisible()).toBe(true);',
        'import { expect } from "@playwright/test";\nexpect(page.getByRole("button").isVisible()).toBe(true);',
        'import { expect } from "@playwright/test";\nconst handle = await page.locator("a").elementHandle();\nexpect(await handle.isVisible()).toBe(true);',
        'import { expect } from "@playwright/test";\nlet field = page.locator("a");\nfield = await field.elementHandle();\nexpect(await field.isVisible()).toBe(true);',
        'import { assert } from "chai";\nassert.equal(value, null);',
        'import { assert } from "chai";\nassert.notStrictEqual(items.length, 3);',
        'import { assert } from "chai";\nconst { strictEqual } = assert;\nstrictEqual(value.length, 1);',
        'import assert from "node:assert";\nassert.strictEqual(value, null);',
        { code: 'expect(value).toBe(NaN);', filename: join(root, 'jasmine/a.spec.ts') },
        { code: 'expect(items.length).toBe(2);', filename: join(root, 'early/a.spec.ts') },
        { code: 'expect(items.length).toBe(2);', filename: join(root, 'major/a.spec.ts') },
        { code: 'expect(items.length).toBe(2);', filename: join(root, 'capped/a.spec.ts') },
    ],
    invalid: [
        ...[
            ['vitest', 'expect(value).not.toEqual(undefined)', 'expect(value).toBeDefined()'],
            ['vitest', 'expect(value).toStrictEqual(NaN)', 'expect(value).toBeNaN()'],
            ['vitest', 'expect(left !== right).toBe(true)', 'expect(left).not.toBe(right)'],
            ['vitest', 'expect(value === null).toBe(false)', 'expect(value).not.toBeNull()'],
            ['vitest', 'expect(undefined === value).toBe(true)', 'expect(value).toBeUndefined()'],
            ['vitest', 'expect(error instanceof TypeError).toBe(true)', 'expect(error).toBeInstanceOf(TypeError)'],
            ['vitest', 'expect(count > 2).toBe(false)', 'expect(count).toBeLessThanOrEqual(2)'],
            ['vitest', 'expect(cart.total >= -1).toBe(true)', 'expect(cart.total).toBeGreaterThanOrEqual(-1)'],
            ['vitest', 'expect(message.includes("ok")).not.toBe(true)', 'expect(message).not.toContain("ok")'],
            ['chai', 'expect(value, "why").to.not.equal(undefined)', 'expect(value, "why").to.not.be.undefined'],
            ['chai', '(left + right).should.equal(null)', '(left + right).should.be.null'],
            ['chai', 'assert.strictEqual(value, null, "why")', 'assert.isNull(value, "why")'],
            ['chai', 'assert.notStrictEqual(error instanceof Error, true)', 'assert.notInstanceOf(error, Error)'],
            ['vitest', 'expect(items.length).toBe(2)', 'expect(items).toHaveLength(2)', 'length'],
            ['vitest', 'expect(items.length === 0).toBe(true)', 'expect(items).toHaveLength(0)', 'length'],
            ['chai', 'items.length.should.equal(3)', 'items.should.have.lengthOf(3)', 'length'],
            ['chai', 'assert.strictEqual(items.length, 3)', 'assert.lengthOf(items, 3)', 'length'],
        ].map(([module = '', call = '', assertion = '', kind = '']) => {
            const header = `import { expect, assert } from "${module}";\n`;
            return {
                code: `${header}${call};`,
                errors: [
                    {
                        messageId: kind === 'length' ? ('length' as const) : ('matcher' as const),
                        data: { assertion },
                        suggestions: [
                            { messageId: 'replace' as const, data: { assertion }, output: `${header}${assertion};` },
                        ],
                    },
                ],
            };
        }),
        ...[
            [
                'expect(await page.locator("input").isEnabled()).not.toBe(true)',
                'await expect(page.locator("input")).toBeDisabled()',
            ],
            ['const row = page.locator("tr");\nexpect(await row.count()).toBe(3)', 'await expect(row).toHaveCount(3)'],
            [
                'const row = page.locator("tr");\nexpect(await row.count()).not.toBe(3)',
                'await expect(row).not.toHaveCount(3)',
            ],
            [
                'expect(await page.locator("tr").getByRole("cell").isVisible()).toBe(true)',
                'await expect(page.locator("tr").getByRole("cell")).toBeVisible()',
            ],
            [
                'const box = page.getByRole("checkbox");\nexpect(await box.isChecked()).toEqual(false)',
                'await expect(box).not.toBeChecked()',
            ],
            [
                'expect(await page.locator("li").first().isVisible()).toBe(true)',
                'await expect(page.locator("li").first()).toBeVisible()',
            ],
            [
                'expect(await frame.getByRole("button").isEnabled()).toBe(true)',
                'await expect(frame.getByRole("button")).toBeEnabled()',
            ],
            [
                'let row;\nrow = page.locator("tr");\nexpect(await row.count()).toBe(3)',
                'await expect(row).toHaveCount(3)',
            ],
        ].map(([call = '', assertion = '']) => ({
            code: `import { test, expect } from "@playwright/test";\n${call};`,
            errors: [{ messageId: 'matcher' as const, data: { assertion } }],
        })),
        {
            code: 'expect(items.length).toEqual(2);',
            filename: join(root, 'jasmine/a.spec.ts'),
            errors: [
                {
                    messageId: 'length',
                    suggestions: [{ messageId: 'replace', output: 'expect(items).toHaveSize(2);' }],
                },
            ],
        },
        {
            code: 'cy.wrap(value).its("name").should("not.deep.equal", undefined);',
            filename: join(root, 'cypress/a.cy.ts'),
            errors: [
                {
                    messageId: 'matcher',
                    column: 28,
                    suggestions: [
                        { messageId: 'replace', output: 'cy.wrap(value).its("name").should(\'not.be.undefined\');' },
                    ],
                },
            ],
        },
    ],
});
