import plugin from '#eslint-plugin/plugin.ts';
import { buildTypedRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildTypedRuleTester().run('no-useless-intersection', plugin.rules['no-useless-intersection'], {
    valid: [
        'type Shape = { size: number } & { name: string };',
        'type Size = "small" | "large" | (string & {});',
        'type Plain<T> = { [K in keyof T]: T[K] } & {};',
        'type Present<T> = T & {};',
        'interface Named { name: string } type Shape = { size: number } & Named;',
    ],
    invalid: [
        { code: 'type Shape = string & any;', errors: [{ messageId: 'absorbing', data: { type: 'any' } }] },
        { code: 'type Shape = never & string;', errors: [{ messageId: 'absorbing', data: { type: 'never' } }] },
        { code: 'interface Empty {} type Shape = { size: number } & Empty;', errors: [{ messageId: 'empty' }] },
        { code: 'type Shape = string & {};', errors: [{ messageId: 'empty' }] },
        { code: 'type Shape = null & { size: number };', errors: [{ messageId: 'empty' }] },
    ],
});
