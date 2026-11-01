import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester, buildTypedRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-redundant-optional', plugin.rules['no-redundant-optional'], {
    valid: [
        'type User = { name?: string };',
        'type User = { name?: undefined };',
        'type User = { name: string | undefined };',
    ],
    invalid: [
        { code: 'type User = { name?: string | undefined };', errors: [{ messageId: 'optional' }] },
        { code: 'class User { name?: string | undefined; }', errors: [{ messageId: 'optional' }] },
        { code: 'type User = { name?: (string | undefined) | number };', errors: [{ messageId: 'optional' }] },
    ],
});

buildTypedRuleTester().run('no-redundant-optional with types', plugin.rules['no-redundant-optional'], {
    valid: ['type Name = string; type User = { name?: Name };'],
    invalid: [
        {
            code: 'type Maybe = string | undefined; type User = { name?: Maybe };',
            errors: [{ messageId: 'optional' }],
        },
    ],
});
