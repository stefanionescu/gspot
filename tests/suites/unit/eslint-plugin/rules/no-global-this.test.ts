import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-global-this', plugin.rules['no-global-this'], {
    valid: [
        'this;',
        'globalThis.name;',
        'function read() { return this.name; }',
        'const Person = class extends this.Base {};',
    ],
    invalid: [{ code: 'this.name;', errors: [{ messageId: 'this' }] }],
});

buildRuleTester({ languageOptions: { sourceType: 'script' } }).run(
    'no-global-this-script',
    plugin.rules['no-global-this'],
    {
        valid: [],
        invalid: [
            { code: 'this.name;', errors: [{ messageId: 'this' }] },
            { code: '"use strict"; this.name;', errors: [{ messageId: 'this' }] },
        ],
    },
);
