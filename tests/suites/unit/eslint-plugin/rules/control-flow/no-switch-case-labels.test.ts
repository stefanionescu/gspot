import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noSwitchCaseLabels } from '#eslint-plugin/rules/control-flow/no-switch-case-labels.ts';

buildRuleTester().run('no-switch-case-labels', noSwitchCaseLabels, {
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
