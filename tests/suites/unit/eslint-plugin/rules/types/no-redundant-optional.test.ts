import { noRedundantOptional } from '#eslint-plugin/rules/types/no-redundant-optional.ts';
import { buildRuleTester, buildTypedRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-redundant-optional', noRedundantOptional, {
    valid: ['type User = { name?: string };', 'type User = { name: string | undefined };'],
    invalid: [{ code: 'type User = { name?: string | undefined };', errors: [{ messageId: 'optional' }] }],
});

buildTypedRuleTester().run('no-redundant-optional with types', noRedundantOptional, {
    valid: ['type Name = string; type User = { name?: Name };'],
    invalid: [
        {
            code: 'type Maybe = string | undefined; type User = { name?: Maybe };',
            errors: [{ messageId: 'optional' }],
        },
    ],
});
