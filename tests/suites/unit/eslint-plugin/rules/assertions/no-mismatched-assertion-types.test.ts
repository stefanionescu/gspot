import { noMismatchedAssertionTypes } from '#eslint-plugin/rules/assertions/no-mismatched-assertion-types.ts';
import { buildTypedRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildTypedRuleTester().run('no-mismatched-assertion-types', noMismatchedAssertionTypes, {
    valid: [
        'import { expect } from "vitest";\ndeclare const count: number;\nexpect(count).toBe(3);',
        'import { expect } from "vitest";\ndeclare const count: number | string;\nexpect(count).toBe("3");',
        'import { expect } from "vitest";\ndeclare const count: number | undefined;\nexpect(count).toBe("3");',
        'import { expect } from "vitest";\ndeclare const shape: { id: number };\nexpect(shape).toEqual("3");',
        'import { expect } from "vitest";\nfunction check<T>(value: T) { expect(value).toBe("3"); }',
        'import { expect } from "vitest";\ndeclare function parse(): any;\nconst count: number = parse();\nexpect(count).toBe("3");',
        'import { expect } from "vitest";\nconst clock = { now: () => 1 };\nclock.now = () => 2;\nexpect(clock.now()).toBe("2");',
        'import { assert } from "chai";\ndeclare const count: number;\nassert.equal(count, "3");',
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
            code: 'import { expect } from "vitest";\ndeclare const count: number | boolean;\nexpect(count).toBe("3");',
            errors: [{ messageId: 'incompatible', data: { received: 'number | boolean', expected: 'string' } }],
        },
    ],
});
