import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { redundantTypeAliases } from '#eslint-plugin/rules/types/redundant-type-aliases.ts';

buildRuleTester().run('redundant-type-aliases', redundantTypeAliases, {
    valid: [
        'type State = "ready" | "pending";',
        'type Result = Promise<User>;',
        'type Result<T extends User> = Promise<T>;',
        'type Result<T = User> = Promise<T>;',
    ],
    invalid: [
        {
            code: 'type Base = { value: string }; type Alias<T> = Base;',
            errors: [{ messageId: 'redundant', data: { type: 'Base' } }],
        },
        { code: 'type Name = string;', errors: [{ messageId: 'redundant', data: { type: 'string' } }] },
        { code: 'type Result = User;', errors: [{ messageId: 'redundant', data: { type: 'User' } }] },
        { code: 'type Result<T> = Promise<T>;', errors: [{ messageId: 'redundant', data: { type: 'Promise<T>' } }] },
    ],
});
