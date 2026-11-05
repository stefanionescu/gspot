import { maxSwitchCases } from '#eslint-plugin/rules/control-flow/max-switch-cases.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('max-switch-cases', maxSwitchCases, {
    valid: [
        'switch (value) {}',
        { code: 'switch (value) { case 1: case 2: run(); default: finish(); }', options: [1] },
        { code: 'switch (value) { case 1: case 2: default: finish(); }', options: [0] },
        { code: 'switch (value) { case 1: break; case 2: break; }', options: [2] },
        ['switch (value) {', ...Array.from({ length: 30 }, (_, index) => `case ${index.toString()}: break;`), '}'].join(
            ' ',
        ),
    ],
    invalid: [
        {
            code: 'switch (value) { case 1: break; case 2: break; default: finish(); }',
            options: [1],
            errors: [{ messageId: 'cases', data: { count: 2, maximum: 1 } }],
        },
        {
            code: 'switch (value) { case 1: {} }',
            options: [0],
            errors: [{ messageId: 'cases', data: { count: 1, maximum: 0 } }],
        },
        {
            code: [
                'switch (value) {',
                ...Array.from({ length: 31 }, (_, index) => `case ${index.toString()}: break;`),
                '}',
            ].join(' '),
            errors: [{ messageId: 'cases', data: { count: 31, maximum: 30 } }],
        },
    ],
});
