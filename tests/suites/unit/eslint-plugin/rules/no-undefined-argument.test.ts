import plugin from '#eslint-plugin/plugin.ts';
import { buildTypedRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildTypedRuleTester().run('no-undefined-argument', plugin.rules['no-undefined-argument'], {
    valid: [
        'function format(value: number, style: string | undefined) {} format(1, undefined);',
        'function format(value: number, style?: string) {} format(1);',
        'function format(value?: number, style?: string) {} format(undefined, "short");',
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
