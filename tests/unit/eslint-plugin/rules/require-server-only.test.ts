import plugin from '#eslint-plugin/plugin.ts';
import { createRuleTester } from '#tests/setup/eslint/rule-tester.ts';

createRuleTester().run('require-server-only', plugin.rules['require-server-only'], {
    valid: ["import 'server-only';\nexport const secret = 1;", "'use server';\nexport async function act() {}"],
    invalid: [{ code: 'export const secret = 1;', errors: [{ messageId: 'missing' }] }],
});
