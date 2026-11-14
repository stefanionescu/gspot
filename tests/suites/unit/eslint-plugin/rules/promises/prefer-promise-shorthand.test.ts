import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { preferPromiseShorthand } from '#eslint-plugin/rules/promises/prefer-promise-shorthand.ts';

buildRuleTester().run('prefer-promise-shorthand', preferPromiseShorthand, {
    valid: [
        'new Promise((resolve) => { setTimeout(resolve, 1); });',
        'new Promise((resolve) => resolve());',
        'new Promise((resolve) => { start(); resolve(1); });',
        'new Promise(start);',
    ],
    invalid: [
        {
            code: 'new Promise((resolve) => resolve(1));',
            errors: [{ messageId: 'shorthand', data: { action: 'resolve' } }],
        },
        {
            code: 'new Promise((resolve, reject) => { reject(new Error("Failed.")); });',
            errors: [{ messageId: 'shorthand', data: { action: 'reject' } }],
        },
    ],
});
