import { noDetachedCall } from '#eslint-plugin/rules/layout/no-detached-call.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-detached-call', noDetachedCall, {
    valid: ['read(value);', 'read\n();', 'tag`text`;', 'read\n(a, b);', 'make()\n(value);', '(read\n)(value);'],
    invalid: [
        ...['read\n(value);', 'read<Type>\n(value);'].map((code) => ({
            code,
            errors: [{ messageId: 'call' as const }],
        })),
        { code: 'tag\n`text`;', errors: [{ messageId: 'template' }] },
    ],
});
