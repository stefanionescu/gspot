import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noGlobalsShadowing } from '#eslint-plugin/rules/variables/no-globals-shadowing.ts';

buildRuleTester().run('no-globals-shadowing', noGlobalsShadowing, {
    valid: ['let undefined;', 'function read(undefined) {}', 'const window = 1;', 'Math.limit = 1;'],
    invalid: [
        {
            code: 'const [Map] = load();',
            errors: [{ messageId: 'declaration', data: { kind: 'variable', name: 'Map' } }],
        },
        {
            code: 'function read(Set = 1) {}',
            errors: [{ messageId: 'declaration', data: { kind: 'parameter', name: 'Set' } }],
        },
        {
            code: 'const { ...Promise } = load();',
            errors: [{ messageId: 'declaration', data: { kind: 'variable', name: 'Promise' } }],
        },

        {
            code: 'function read(Object) {}',
            errors: [{ messageId: 'declaration', data: { kind: 'parameter', name: 'Object' } }],
        },
        { code: 'const NaN = 1;', errors: [{ messageId: 'declaration', data: { kind: 'variable', name: 'NaN' } }] },
        {
            code: 'let undefined = 1;',
            errors: [{ messageId: 'declaration', data: { kind: 'variable', name: 'undefined' } }],
        },
        {
            code: 'function read(...undefined) {}',
            errors: [{ messageId: 'declaration', data: { kind: 'parameter', name: 'undefined' } }],
        },
        { code: 'Math = 1;', errors: [{ messageId: 'assignment', data: { kind: 'assignment', name: 'Math' } }] },
        {
            code: 'const { Map } = values;',
            errors: [{ messageId: 'declaration', data: { kind: 'variable', name: 'Map' } }],
        },
        {
            code: 'try {} catch (Error) {}',
            errors: [{ messageId: 'declaration', data: { kind: 'variable', name: 'Error' } }],
        },
        {
            code: 'function read(arguments) {}',
            errors: [{ messageId: 'declaration', data: { kind: 'parameter', name: 'arguments' } }],
        },
        {
            code: 'function parseInt() {}',
            errors: [{ messageId: 'declaration', data: { kind: 'function', name: 'parseInt' } }],
        },
        { code: 'NaN++;', errors: [{ messageId: 'assignment', data: { name: 'NaN' } }] },
        {
            code: 'const read = (Set) => function (Map) {};',
            errors: [
                { messageId: 'declaration', data: { kind: 'parameter', name: 'Set' } },
                { messageId: 'declaration', data: { kind: 'parameter', name: 'Map' } },
            ],
        },
    ],
});
