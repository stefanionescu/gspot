import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-switch-case-labels', plugin.rules['no-switch-case-labels'], {
    valid: [
        'retry: while (ready) run();',
        'switch (value) { case 1: function repeat() { retry: while (ready) run(); } }',
    ],
    invalid: [
        {
            code: 'switch (value) { case 1: retry: while (ready) run(); }',
            errors: [{ messageId: 'label' }],
        },
        {
            code: 'switch (value) { case 1: function repeat() {} retry: while (ready) run(); case 2: later: run(); }',
            errors: [{ messageId: 'label' }, { messageId: 'label' }],
        },
    ],
});
