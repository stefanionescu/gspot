import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('prefer-promise-shorthand', plugin.rules['prefer-promise-shorthand'], {
    valid: [
        'new Promise((resolve) => { setTimeout(resolve, 1); });',
        'new Promise((resolve) => resolve());',
        'new Promise((resolve) => { start(); resolve(1); });',
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
