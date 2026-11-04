import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { preferTypeAlias } from '#eslint-plugin/rules/types/prefer-type-alias.ts';

buildRuleTester().run('prefer-type-alias', preferTypeAlias, {
    valid: [
        'function resize(first: "s" | "m" | "l", second: "s" | "m" | "l") {}',
        'type Size = "s" | "m" | "l"; function resize(first: "s" | "m" | "l", second: "s" | "m" | "l") {}',
        'function read(first: string | null | undefined, second: string | null | undefined, third: string | null | undefined) {}',
        'function resize(first: "s" | "m", second: "s" | "m", third: "s" | "m") {}',
    ],
    invalid: [
        {
            code: 'function resize(first: "s" | "m" | "l", second: "m" | "l" | "s", third: "s" | "m" | "l") {}',
            errors: [{ messageId: 'alias', data: { kind: 'union', count: 3 } }],
        },
        {
            code: 'let first: A & B & C; let second: A & B & C; let third: C & B & A;',
            errors: [{ messageId: 'alias', data: { kind: 'intersection', count: 3 } }],
        },
    ],
});
