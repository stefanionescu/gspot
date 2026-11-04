import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noGlobalThis } from '#eslint-plugin/rules/variables/no-global-this.ts';

buildRuleTester().run('no-global-this', noGlobalThis, {
    valid: [
        'this;',
        'globalThis.name;',
        'function read() { return this.name; }',
        'const Person = class extends this.Base {};',
    ],
    invalid: [{ code: 'this.name;', errors: [{ messageId: 'this' }] }],
});

buildRuleTester({ languageOptions: { sourceType: 'script' } }).run('no-global-this-script', noGlobalThis, {
    valid: [],
    invalid: [
        { code: 'this.name;', errors: [{ messageId: 'this' }] },
        { code: '"use strict"; this.name;', errors: [{ messageId: 'this' }] },
    ],
});
