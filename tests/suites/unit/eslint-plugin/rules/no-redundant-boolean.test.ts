import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-redundant-boolean', plugin.rules['no-redundant-boolean'], {
    valid: [
        'value === true;',
        'value !== false;',
        'value == "true";',
        '!value;',
        'const result = value || true;',
        'const result = value || false;',
        'while (value || false) run();',
        'value ? other || true : false;',
        'const result = value ?? false;',
        'if (value) run();',
    ],
    invalid: [
        ...[
            'value == true;',
            'false != value;',
            '!true;',
            '!false;',
            'true && value;',
            'value && true;',
            'false || value;',
            'true ?? value;',
            'if (value || false) run();',
            '(value || true) ? first : second;',
            'if (value) true || run();',
            'const result = run() && false;',
        ].map((code) => ({ code, errors: [{ messageId: 'boolean' as const }] })),
        ...['true == false;', 'true && false;', 'if (false || true) run();'].map((code) => ({
            code,
            errors: [{ messageId: 'boolean' as const }, { messageId: 'boolean' as const }],
        })),
    ],
});
