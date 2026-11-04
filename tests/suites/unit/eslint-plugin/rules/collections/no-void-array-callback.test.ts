import { buildRuleTester, buildTypedRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noVoidArrayCallback } from '#eslint-plugin/rules/collections/no-void-array-callback.ts';

const rule = noVoidArrayCallback;
const declarations = 'declare function log(value: unknown): void; declare const values: number[];';

buildRuleTester().run('no-void-array-callback', rule, {
    valid: ['function log(value) {} [1, 2].map(log);'],
    invalid: [],
});

buildTypedRuleTester().run('no-void-array-callback', rule, {
    valid: [
        `${declarations} values.forEach(log);`,
        `${declarations} values.map((value) => { log(value); });`,
        `${declarations} values.map(Number);`,
        `${declarations} declare const list: { map(callback: unknown): void }; list.map(log);`,
    ],
    invalid: [
        {
            code: `${declarations} values.map(log);`,
            errors: [{ messageId: 'void', data: { method: 'values.map' }, column: 88 }],
        },
        {
            code: `${declarations} values.filter((value) => log(value));`,
            errors: [{ messageId: 'void', data: { method: 'values.filter' } }],
        },
        {
            code: `${declarations} Array.from(values, log);`,
            errors: [{ messageId: 'void', data: { method: 'Array.from' } }],
        },
    ],
});
