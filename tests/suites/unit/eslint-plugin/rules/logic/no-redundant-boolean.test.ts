import { noRedundantBoolean } from '#eslint-plugin/rules/logic/no-redundant-boolean.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-redundant-boolean', noRedundantBoolean, {
    valid: [
        'value === true;',
        'value == "true";',
        'const result = value || true;',
        'value ? other || true : false;',
        'const result = value ?? false;',
    ],
    invalid: [
        'value == true;',
        '!true;',
        'value && true;',
        'if (value || false) run();',
        '(value || true) ? first : second;',
        'const result = false || value;',
    ].map((code) => ({ code, errors: [{ messageId: 'boolean' as const }] })),
});
