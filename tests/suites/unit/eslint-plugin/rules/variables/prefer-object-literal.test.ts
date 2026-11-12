import { preferObjectLiteral } from '#eslint-plugin/rules/variables/prefer-object-literal.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('prefer-object-literal', preferObjectLiteral, {
    valid: [
        'const user = { name };',
        'const user = {}; initialize(user); user.name = name;',
        'const user = {}; user.self = user;',
        'const user = {}; user.name = build(\n name\n);',
        'const user = {}; another.name = name;',
        'const user = {}; user.profile.name = name;',
    ],
    invalid: [
        {
            code: 'const user = {}; import { name } from "user"; user.name = name;',
            errors: [{ messageId: 'literal' }],
        },
        { code: 'const other = {}, user = {}; user.name = name;', errors: [{ messageId: 'literal' }] },
        {
            code: 'function read() { const user = {}; user["name"] = name; return user; }',
            errors: [{ messageId: 'literal' }],
        },
    ],
});
