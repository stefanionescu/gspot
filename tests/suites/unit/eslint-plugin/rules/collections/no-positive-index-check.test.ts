import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester, buildTypedRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-positive-index-check', plugin.rules['no-positive-index-check'], {
    valid: ['read(undefined);'],
    invalid: [],
});

buildTypedRuleTester().run('no-positive-index-check', plugin.rules['no-positive-index-check'], {
    valid: [
        'declare const roles: string[], role: string; if (roles.indexOf(role) >= 0) run();',
        'declare const title: string; if (title.indexOf("x") > 0) run();',
    ],
    invalid: [
        {
            code: 'declare const roles: string[], role: string; if (roles.indexOf(role) > 0) run();',
            errors: [{ messageId: 'positive' }],
        },
    ],
});
