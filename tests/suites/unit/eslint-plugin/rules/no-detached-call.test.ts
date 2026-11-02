import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-detached-call', plugin.rules['no-detached-call'], {
    valid: ['read(value);', 'read\n();', 'new Factory\n(value);', 'read<Type>(value);', 'tag`text`;'],
    invalid: [
        ...['read\n(value);', '((read))\n(value);', 'read<Type>\n(value);'].map((code) => ({
            code,
            errors: [{ messageId: 'call' as const }],
        })),
        ...['tag\n`text`;'].map((code) => ({
            code,
            errors: [{ messageId: 'template' as const }],
        })),
    ],
});
