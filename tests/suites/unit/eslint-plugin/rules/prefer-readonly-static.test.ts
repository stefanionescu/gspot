import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('prefer-readonly-static', plugin.rules['prefer-readonly-static'], {
    valid: [
        { filename: 'clock.js', code: 'class Clock { static interval = 1000; }' },
        { filename: 'clock.mts', code: 'class Clock { static interval = 1000; }' },
        { filename: 'clock.cts', code: 'class Clock { static interval = 1000; }' },
        { filename: 'clock.ts', code: 'class Clock { static readonly interval = 1000; }' },
        { filename: 'clock.ts', code: 'class Clock { private static interval = 1000; }' },
        { filename: 'clock.ts', code: 'class Clock { protected static interval = 1000; }' },
        { filename: 'clock.ts', code: 'class Clock { public interval = 1000; }' },
        { filename: 'clock.ts', code: 'class Clock { static interval() { return 1000; } }' },
    ],
    invalid: [
        {
            filename: 'clock.ts',
            code: 'class Clock { static interval = 1000; }',
            errors: [{ messageId: 'readonly' }],
        },
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
