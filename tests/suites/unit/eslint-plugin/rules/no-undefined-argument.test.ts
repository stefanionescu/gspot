import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester, buildTypedRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-undefined-argument', plugin.rules['no-undefined-argument'], {
    valid: ['read(undefined);'],
    invalid: [],
});

buildTypedRuleTester().run('no-undefined-argument', plugin.rules['no-undefined-argument'], {
    valid: [
        'function format(value: number, style: string | undefined) {} format(1, undefined);',
        'function format(value: number, style?: string) {} format(1);',
    ],
    invalid: [
        {
            code: 'function format(value: number, style?: string) {} format(1, undefined);',
            errors: [{ messageId: 'undefined' }],
        },
        {
            code: 'function format(value: number, style = "short") {} format(1, undefined);',
            errors: [{ messageId: 'undefined' }],
        },
    ],
});
