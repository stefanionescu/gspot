import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { preferReadonlyStatic } from '#eslint-plugin/rules/types/prefer-readonly-static.ts';

buildRuleTester().run('prefer-readonly-static', preferReadonlyStatic, {
    valid: [
        { filename: 'clock.js', code: 'class Clock { static interval = 1000; }' },
        { filename: 'clock.ts', code: 'class Clock { static readonly interval = 1000; }' },
        { filename: 'clock.ts', code: 'class Clock { private static interval = 1000; }' },
        { filename: 'clock.ts', code: 'class Clock { protected static interval = 1000; }' },
        { filename: 'clock.ts', code: 'class Clock { public interval = 1000; }' },
    ],
    invalid: [
        {
            filename: 'clock.tsx',
            code: 'class Clock { public static interval = 1000; }',
            errors: [{ messageId: 'readonly' }],
        },
        {
            filename: 'clock.TS',
            code: 'class Clock { static interval = 1000; }',
            errors: [{ messageId: 'readonly' }],
        },
    ],
});
