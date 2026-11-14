import { buildTypedRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noAsyncConstructor } from '#eslint-plugin/rules/promises/no-async-constructor.ts';

buildTypedRuleTester().run('no-async-constructor', noAsyncConstructor, {
    valid: [
        'class Store { ready: Promise<void>; constructor() { this.ready = Promise.resolve(); } }',
        'declare function load(): Promise<void>; class Store { constructor() { const start = () => { load(); }; } }',
        'declare function load(): void; class Store { constructor() { load(); } }',
        'declare function load(): Promise<void>; load();',
    ],
    invalid: [
        {
            code: 'declare function load(): Promise<void>; class Store { constructor() { load(); } }',
            errors: [{ messageId: 'async' }],
        },
        {
            code: 'declare function load(): Promise<void>; class Store { constructor() { const first = load(); const second = load(); } }',
            errors: [
                { messageId: 'async', column: 71 },
                { messageId: 'async', column: 93 },
            ],
        },
        {
            code: 'declare function load(): Promise<void>; class Store { ready: unknown; constructor() { this.ready = load(); } }',
            errors: [{ messageId: 'async' }],
        },
    ],
});
