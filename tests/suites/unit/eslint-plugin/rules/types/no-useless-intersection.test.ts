import { buildTypedRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noUselessIntersection } from '#eslint-plugin/rules/types/no-useless-intersection.ts';

buildTypedRuleTester().run('no-useless-intersection', noUselessIntersection, {
    valid: [
        'type Size = "small" | "large" | (string & {});',
        'type Plain<T> = { [K in keyof T]: T[K] } & {};',
        'type Present<T> = T & {};',
    ],
    invalid: [
        { code: 'type Shape = string & any;', errors: [{ messageId: 'absorbing', data: { type: 'any' } }] },
        { code: 'interface Empty {} type Shape = { size: number } & Empty;', errors: [{ messageId: 'empty' }] },
        { code: 'type Shape = string & {};', errors: [{ messageId: 'empty' }] },
        { code: 'type Shape = null & { size: number };', errors: [{ messageId: 'empty' }] },
    ],
});
