import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-detached-call', plugin.rules['no-detached-call'], {
    valid: [
        'read(value);',
        'read(\n value\n);',
        'read\n();',
        'read\n(first, second);',
        'factory()\n(value);',
        '(factory())\n(value);',
        'new Factory\n(value);',
        'read?.\n(value);',
        'read<Type>(value);',
        'tag`text`;',
        '(tag\n)`text`;',
        'read /* note */ (value);',
    ],
    invalid: [
        ...[
            'read\n(value);',
            '((read))\n(value);',
            'read // note\n(value);',
            'read\n(\n value\n);',
            'read<Type>\n(value);',
            'read\n?.(value);',
            'receiver.read\n(value);',
            'read\n(...values);',
        ].map((code) => ({ code, errors: [{ messageId: 'call' as const }] })),
        ...['tag\n`text`;', 'tag // note\n`text`;', '(tag)\n`text`;', 'tag<Type>\n`text`;'].map((code) => ({
            code,
            errors: [{ messageId: 'template' as const }],
        })),
    ],
});
