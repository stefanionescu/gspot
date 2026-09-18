import { tester } from '#plugin-tests/harness/tester.ts';
import { requireServerOnly } from '#plugin/rules/require-server-only.ts';

tester().run('require-server-only', requireServerOnly, {
    valid: ["import 'server-only';\nexport const secret = 1;", "'use server';\nexport async function act() {}"],
    invalid: [{ code: 'export const secret = 1;', errors: [{ messageId: 'missing' }] }],
});
