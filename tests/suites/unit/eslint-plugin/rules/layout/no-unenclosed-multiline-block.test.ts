import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noUnenclosedMultilineBlock } from '#eslint-plugin/rules/layout/no-unenclosed-multiline-block.ts';

buildRuleTester().run('no-unenclosed-multiline-block', noUnenclosedMultilineBlock, {
    valid: ['if (isReady) {\n    run();\n    notify();\n}', 'if (isReady) run();\nfinish();'],
    invalid: [
        {
            code: 'namespace Tasks {\n    if (isReady)\n        run();\n        notify();\n}',
            errors: [{ messageId: 'unenclosed', data: { runs: 'unconditionally' } }],
        },

        {
            code: 'if (isReady)\n    run();\n    notify();',
            errors: [{ messageId: 'unenclosed', data: { runs: 'unconditionally' }, line: 3 }],
        },
        {
            code: 'if (isReady) run(); notify();',
            errors: [{ messageId: 'unenclosed', data: { runs: 'unconditionally' } }],
        },
        {
            code: 'if (isReady) run();\n    notify();',
            errors: [{ messageId: 'unenclosed', data: { runs: 'unconditionally' }, line: 2 }],
        },
        {
            code: 'for (const item of items) run(item); notify();',
            errors: [{ messageId: 'unenclosed', data: { runs: 'only once' } }],
        },
        {
            code: 'if (isReady) run();\nelse\n    stop();\n    notify();',
            errors: [{ messageId: 'unenclosed', data: { runs: 'unconditionally' }, line: 4 }],
        },
        {
            code: 'function start() {\n    if (isReady)\n        run();\n        notify();\n}',
            errors: [{ messageId: 'unenclosed', data: { runs: 'unconditionally' }, line: 4 }],
        },
    ],
});
