import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester({ languageOptions: { sourceType: 'script' } }).run(
    'no-globals-shadowing',
    plugin.rules['no-globals-shadowing'],
    {
        valid: [
            'let undefined;',
            'function read(undefined) {}',
            'function toString() {}',
            'const escape = 1;',
            'const window = 1;',
            'Math.limit = 1;',
        ],
        invalid: [
            { code: 'const [Map] = load();', errors: [{ messageId: 'declaration' }] },
            { code: 'function read(Set = 1) {}', errors: [{ messageId: 'declaration' }] },
            { code: 'const { ...Promise } = load();', errors: [{ messageId: 'declaration' }] },

            {
                code: 'function read(Object) {}',
                errors: [{ messageId: 'declaration', data: { kind: 'parameter', name: 'Object' } }],
            },
            { code: 'const NaN = 1;', errors: [{ messageId: 'declaration', data: { kind: 'variable', name: 'NaN' } }] },
            { code: 'let undefined = 1;', errors: [{ messageId: 'declaration' }] },
            { code: 'function read(...undefined) {}', errors: [{ messageId: 'declaration' }] },
            { code: 'Math = 1;', errors: [{ messageId: 'assignment', data: { kind: 'assignment', name: 'Math' } }] },
            { code: 'const { Map } = values;', errors: [{ messageId: 'declaration' }] },
            { code: 'try {} catch (Error) {}', errors: [{ messageId: 'declaration' }] },
            { code: 'function read(arguments) {}', errors: [{ messageId: 'declaration' }] },
            {
                code: 'function parseInt() {}',
                errors: [{ messageId: 'declaration', data: { kind: 'function', name: 'parseInt' } }],
            },
            { code: 'NaN++;', errors: [{ messageId: 'assignment' }] },
        ],
    },
);
