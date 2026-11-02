import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

const constantCases = [
    ['vitest', 'expect(-1).toBe(-1);'],
    ['vitest', 'const LIMIT = 3;\nexpect(LIMIT).not.toBe(4);'],
    ['vitest', 'expect(NaN).toBe(NaN);'],
    ['vitest', 'expect(undefined).toBeUndefined();'],
    ['vitest', 'expect(1).toBeDefined();'],
    ['@playwright/test', 'expect("a").toBe("a");'],
    ['chai', 'expect(true).to.be.true;'],
    ['chai', 'expect(1).to.not.equal(2);'],
    ['chai', 'assert.isNull(null);'],
    ['chai', 'assert.equal(null, undefined);'],
    ['chai', 'assert(1);'],
    ['node:assert/strict', 'assert(true);'],
].map(([module = '', body = '']) => ({
    code: `import { expect, assert } from "${module}";\n${body}`,
    errors: [{ messageId: 'constant' as const }],
}));

const freshCases = [
    ['vitest', 'expect([]).toBeTruthy();'],
    ['vitest', 'expect(new Date()).not.toBeNull();'],
    ['vitest', 'expect(/a/u).toBeDefined();'],
    ['chai/register-should', '({}).should.exist;'],
].map(([module = '', body = '']) => ({
    code: `import { expect, assert } from "${module}";\n${body}`,
    errors: [{ messageId: 'fresh' as const }],
}));

buildRuleTester().run('no-constant-assertions', plugin.rules['no-constant-assertions'], {
    valid: [
        'expect(true).toBe(true);',
        `import { expect } from "vitest";\nexpect(isReady()).toBe(true);`,
        `import { expect } from "vitest";\nexpect(true).toBe(false);`,
        `import { expect } from "vitest";\nexpect(total).toBeTruthy();`,
        `import { expect } from "vitest";\nexpect([1]).toEqual([1]);`,
        `import { expect } from "vitest";\nexpect(null).toBeTruthy();`,
        `import { expect } from "vitest";\nexpect({}).not.toBeTruthy();`,
        `import { expect } from "vitest";\nexpect(NaN).not.toBe(NaN);`,
        `import { expect, assert } from "chai";\nexpect(total).to.equal(3);`,
        `import { expect, assert } from "chai";\nexpect(1).to.equal(2);`,
        `import { expect, assert } from "chai";\nassert.deepEqual(load(), []);`,
        `import { expect } from "chai";\nexpect([1]).to.deep.equal([1]);`,
        `import { expect } from "vitest";\nexpect(1).toBeGreaterThan(1);`,
        `import "cypress";\ncy.wrap(1).should("deep.include", 1);`,
        `import "cypress";\ncy.wrap(1).should(chainer, 1);`,
        'import assert from "node:assert";\nassert.ok(total);',
        'import assert from "node:assert";\nassert.equal(total, 1);',
    ],
    invalid: [
        ...constantCases,
        ...freshCases,
        {
            code: `import { expect } from "vitest";\nexpect(true).toBe(true);`,
            errors: [{ messageId: 'constant', line: 2, column: 8 }],
        },
        {
            code: `import { expect } from "vitest";\nexpect(load()).toBe({ id: 1 });`,
            errors: [{ messageId: 'identity', data: { matcher: 'toEqual' }, line: 2, column: 21 }],
        },
        {
            code: `import { expect } from "vitest";\nexpect([]).not.toBe(load());`,
            errors: [{ messageId: 'identity', data: { matcher: 'not.toEqual' }, line: 2, column: 8 }],
        },
        {
            code: `import { expect, assert } from "chai";\nexpect(load()).to.equal([1]);`,
            errors: [{ messageId: 'identity', data: { matcher: 'deep.equal' }, line: 2, column: 25 }],
        },
        {
            code: 'import assert from "node:assert";\nassert.strictEqual(load(), () => 1);',
            errors: [{ messageId: 'identity', data: { matcher: 'deepStrictEqual' }, line: 2, column: 28 }],
        },
    ],
});
