import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester, buildTypedRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-mismatched-assertion-types', plugin.rules['no-mismatched-assertion-types'], {
    valid: ['read(undefined);'],
    invalid: [],
});

buildTypedRuleTester().run('no-mismatched-assertion-types', plugin.rules['no-mismatched-assertion-types'], {
    valid: [
        'import { expect } from "vitest";\ndeclare const count: number;\nexpect(count).toBe(3);',
        'import { expect } from "vitest";\ndeclare const count: number | string;\nexpect(count).toBe("3");',
        'import { expect } from "vitest";\ndeclare const count: number | undefined;\nexpect(count).toBe("3");',
        'import { expect } from "vitest";\ndeclare const shape: { id: number };\nexpect(shape).toEqual("3");',
        'import { expect } from "vitest";\ndeclare const value: any;\nexpect(value).toBe("3");',
        'import { expect } from "vitest";\nfunction check<T>(value: T) { expect(value).toBe("3"); }',
        'import { expect } from "vitest";\ndeclare function parse(): any;\nconst count: number = parse();\nexpect(count).toBe("3");',
        'import { expect } from "vitest";\nconst clock = { now: () => 1 };\nclock.now = () => 2;\nexpect(clock.now()).toBe("2");',
        'import { assert } from "chai";\ndeclare const count: number;\nassert.equal(count, "3");',
        'declare const expect: (value: unknown) => { toBe(other: unknown): void };\ndeclare const count: number;\nexpect(count).toBe("3");',
    ],
    invalid: [
        {
            code: 'import { expect } from "vitest";\ndeclare const count: number;\nexpect(count).toBe("3");',
            errors: [
                { messageId: 'incompatible', data: { received: 'number', expected: 'string' }, line: 3, column: 15 },
            ],
        },
        {
            code: 'import { expect } from "vitest";\ndeclare const ready: boolean;\nexpect(ready).not.toEqual(1n);',
            errors: [{ messageId: 'incompatible', data: { received: 'boolean', expected: 'bigint' } }],
        },
        {
            code: 'import { expect } from "chai";\nconst label = "a";\nexpect(label).to.equal(1);',
            errors: [{ messageId: 'incompatible', data: { received: 'string', expected: 'number' } }],
        },
        {
            code: 'import { assert } from "chai";\ndeclare const count: number;\nassert.strictEqual(count, "3");',
            errors: [{ messageId: 'incompatible' }],
        },
        {
            code: 'import assert from "node:assert/strict";\ndeclare const count: number;\nassert.deepStrictEqual(count, true);',
            errors: [{ messageId: 'incompatible', data: { received: 'number', expected: 'boolean' } }],
        },
    ],
});
