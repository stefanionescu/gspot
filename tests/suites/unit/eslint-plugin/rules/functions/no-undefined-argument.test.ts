import { noUndefinedArgument } from '#eslint-plugin/rules/functions/no-undefined-argument.ts';
import { buildTypedRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildTypedRuleTester().run('no-undefined-argument', noUndefinedArgument, {
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
