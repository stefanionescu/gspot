import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-duplicated-branches', plugin.rules['no-duplicated-branches'], {
    valid: [
        'if (first) { run(); } else if (second) { run(); } else { stop(); }',
        'switch (mode) { case 1: { run(); } break; case 2: run(); break; }',
        'switch (mode) { case 1: run(); break; case 2: run(); break; default: }',
        'const value = isReady ? first : second;',
        'if (first) {\n    run();\n    stop();\n} else if (second) {\n    stop();\n}',
    ],
    invalid: [
        {
            code: 'if (first) {\n    run();\n    stop();\n} else if (second) {\n    stop();\n} else if (third) {\n    run();\n    stop();\n}',
            errors: [{ messageId: 'branch', data: { kind: 'branch', line: 1 }, line: 6 }],
        },
        {
            code: 'if (first) run(); else if (second) run();',
            errors: [{ messageId: 'branch', data: { kind: 'branch', line: 1 } }],
        },
        { code: 'if (first) run(); else run();', errors: [{ messageId: 'all', data: { kind: 'branch' } }] },
        {
            code: 'switch (mode) { case 1: run(); break; default: run(); }',
            errors: [{ messageId: 'all', data: { kind: 'case' } }],
        },
        {
            code: 'switch (mode) { case 1: run(); break; case 2: run(); break; }',
            errors: [{ messageId: 'branch', data: { kind: 'case', line: 1 } }],
        },
        {
            code: 'switch (mode) {\ncase 1:\n    run();\n    stop();\n    break;\ncase 2:\n    stop();\n    break;\ncase 3:\n    run();\n    stop();\n    break;\n}',
            errors: [{ messageId: 'branch', data: { kind: 'case', line: 2 }, line: 9 }],
        },
        { code: 'const value = isReady ? first : first;', errors: [{ messageId: 'ternary' }] },
    ],
});
