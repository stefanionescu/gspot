import { noPositiveIndexCheck } from '#eslint-plugin/rules/collections/no-positive-index-check.ts';
import { buildTypedRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildTypedRuleTester().run('no-positive-index-check', noPositiveIndexCheck, {
    valid: [
        'declare const roles: string[], role: string; if (roles.indexOf(role) >= 0) run();',
        'declare const title: string; if (title.indexOf("x") > 0) run();',
        'declare const roles: string[], role: string; if (roles.push(role) > 0) run();',
    ],
    invalid: [
        {
            code: 'declare const roles: string[], role: string; if (roles.indexOf(role) > 0) run();',
            errors: [{ messageId: 'positive' }],
        },
    ],
});
