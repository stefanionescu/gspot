import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-gratuitous-expressions', plugin.rules['no-gratuitous-expressions'], {
    valid: [
        'function start(ready) { if (ready) { ready = check(); if (ready) run(); } }',
        'function start(ready) { if (ready) run(ready && other); }',
        'function start(ready) { if (!ready) { run(); } else if (ready) { run(); } }',
        'function start(ready, other) { if (ready && (other && last)) { if (other) run(); } }',
        'function start(ready) { if (ready) { run(ready); } }',
        'function start(ready) { const reset = () => { ready = false; }; if (ready) { if (ready) run(reset); } }',
    ],
    invalid: [
        { code: 'if (true) run();', errors: [{ messageId: 'decided', data: { value: 'truthy' } }] },

        {
            code: 'function start(ready) { if (ready) { if (ready) run(); } }',
            errors: [{ messageId: 'decided', data: { value: 'truthy' }, column: 42 }],
        },
        {
            code: 'function start(ready) { if (!ready) { run(!ready); } }',
            errors: [{ messageId: 'decided', data: { value: 'falsy' }, column: 44 }],
        },
        {
            code: 'function start(ready) { if (ready) { run(); } else { run(ready || other); } }',
            errors: [{ messageId: 'decided', data: { value: 'falsy' }, column: 58 }],
        },
        {
            code: 'function start(ready, other) { if (ready && !other) { if (other) run(); } }',
            errors: [{ messageId: 'decided', data: { value: 'falsy' } }],
        },
        { code: 'if (false) run();', errors: [{ messageId: 'decided', data: { value: 'falsy' } }] },
    ],
});
