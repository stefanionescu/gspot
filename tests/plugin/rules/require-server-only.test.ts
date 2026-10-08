import plugin from '#plugin/rules/public.ts';
import { createRuleTester } from '#tests/harness/rule-tester.ts';

createRuleTester().run('require-server-only', plugin.rules['require-server-only'], {
    valid: ["import 'server-only';\nexport const secret = 1;", "'use server';\nexport async function act() {}"],
    invalid: [{ code: 'export const secret = 1;', errors: [{ messageId: 'missing' }] }],
});
