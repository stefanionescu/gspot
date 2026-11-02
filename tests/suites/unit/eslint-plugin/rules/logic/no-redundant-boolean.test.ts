import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-redundant-boolean', plugin.rules['no-redundant-boolean'], {
    valid: [
        'value === true;',
        'value == "true";',
        '!value;',
        'const result = value || true;',
        'value ? other || true : false;',
        'const result = value ?? false;',
    ],
    invalid: [
        ...[
            'value == true;',
            '!true;',
            'true && value;',
            'value && true;',
            'if (value || false) run();',
            '(value || true) ? first : second;',
        ].map((code) => ({ code, errors: [{ messageId: 'boolean' as const }] })),
        ...['true == false;', 'true && false;', 'if (false || true) run();'].map((code) => ({
            code,
            errors: [{ messageId: 'boolean' as const }, { messageId: 'boolean' as const }],
        })),
    ],
});
