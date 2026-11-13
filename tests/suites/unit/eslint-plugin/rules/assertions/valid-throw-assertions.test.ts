import { validThrowAssertions } from '#eslint-plugin/rules/assertions/valid-throw-assertions.ts';
import { buildRuleTester, buildTypedRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildTypedRuleTester().run('valid-throw-assertions', validThrowAssertions, {
    valid: [
        'import { expect } from "vitest";\ndeclare function parse(): number;\nexpect(() => parse()).toThrow();',
        'import { expect } from "vitest";\ndeclare const value: any;\nexpect(value).toThrow();',
        'import { expect } from "vitest";\nfunction check<T>(value: T) { expect(value).toThrow(); }',
        'import { expect } from "vitest";\ndeclare const load: () => Promise<void>;\nawait expect(load()).rejects.toThrow();',
        'declare const expect: (value: unknown) => { toThrow(): void };\ndeclare function parse(): number;\nexpect(parse()).toThrow();',
        'import { expect } from "vitest";\ndeclare function parse(): number;\nexpect(parse()).toThrow().valueOf();',
    ],
    invalid: [
        {
            code: 'import { expect } from "vitest";\ndeclare function parse(): number;\nexpect(parse()).toThrow();',
            errors: [
                {
                    messageId: 'value',
                    data: { matcher: 'toThrow' },
                    line: 3,
                    column: 8,
                    suggestions: [
                        {
                            messageId: 'wrap',
                            output: 'import { expect } from "vitest";\ndeclare function parse(): number;\nexpect(() => parse()).toThrow();',
                        },
                    ],
                },
            ],
        },
        {
            code: 'import { expect } from "vitest";\ndeclare class Parser {}\nexpect(new Parser()).toThrow();',
            errors: [
                {
                    messageId: 'value',
                    data: { matcher: 'toThrow' },
                    suggestions: [
                        {
                            messageId: 'wrap',
                            output: 'import { expect } from "vitest";\ndeclare class Parser {}\nexpect(() => new Parser()).toThrow();',
                        },
                    ],
                },
            ],
        },
        {
            code: 'import { expect } from "@jest/globals";\ndeclare const load: () => Promise<void>;\nexpect(load()).not.toThrowError();',
            errors: [{ messageId: 'value', data: { matcher: 'toThrowError' }, suggestions: [] }],
        },
        {
            code: 'import { expect } from "bun:test";\ndeclare const total: number | string;\nexpect(total).toThrow();',
            errors: [{ messageId: 'value', suggestions: [] }],
        },
        {
            code: 'import { expect, test } from "vitest";\ntest("load", async () => {\n    expect(async () => load()).toThrow();\n});',
            errors: [
                {
                    messageId: 'async',
                    suggestions: [
                        {
                            messageId: 'rejection',
                            output: 'import { expect, test } from "vitest";\ntest("load", async () => {\n    await expect((async () => load())()).rejects.toThrow();\n});',
                        },
                    ],
                },
            ],
        },
    ],
});

buildRuleTester().run('valid-throw-assertions without types', validThrowAssertions, {
    valid: ['import { expect } from "vitest";\nexpect(parse()).toThrow();'],
    invalid: [
        {
            code: 'const { expect } = require("vitest");\nexpect(async function () { await load(); }).not.toThrow();',
            errors: [{ messageId: 'async', suggestions: [] }],
        },
    ],
});
