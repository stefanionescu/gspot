import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-adjacent-multiline-if', plugin.rules['no-adjacent-multiline-if'], {
    valid: [
        'if (first) run(); if (second) run();',
        'if (first) {\n run();\n}\nif (second) run();',
        'if (first) {\n run();\n} else if (second) run();',
        'if (first) {\n run();\n} ; if (second) run();',
        'while (first) {\n run();\n} if (second) run();',
        'namespace App { if (first) {\n run();\n} if (second) run(); }',
    ],
    invalid: [
        'if (first) {\n run();\n} if (second) run();',
        'if (first) run(); if (second) {\n run();\n}',
        'function run() { if (first) {\n run();\n} if (second) run(); }',
        'switch (value) { case 1: if (first) {\n run();\n} if (second) run(); }',
        'if (first) {\n run();\n} /* independent */ if (second) run();',
        'if (first) run(); else {\n run();\n} if (second) run();',
    ].map((code) => ({ code, errors: [{ messageId: 'line' as const }] })),
});
