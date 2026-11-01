import plugin from '#eslint-plugin/plugin.ts';
import { buildTypedRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildTypedRuleTester().run('no-async-constructor', plugin.rules['no-async-constructor'], {
    valid: [
        'class Store { ready: Promise<void>; constructor() { this.ready = Promise.resolve(); } }',
        'declare function load(): Promise<void>; class Store { constructor() { const start = () => { load(); }; } }',
        'declare function load(): void; class Store { constructor() { load(); } }',
    ],
    invalid: [
        {
            code: 'declare function load(): Promise<void>; class Store { constructor() { load(); } }',
            errors: [{ messageId: 'async' }],
        },
        {
            code: 'declare function load(): Promise<void>; class Store { constructor(ready: boolean) { if (ready) { load(); } } }',
            errors: [{ messageId: 'async' }],
        },
    ],
});
