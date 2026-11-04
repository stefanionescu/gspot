import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noKeywordDeclarations } from '#eslint-plugin/rules/variables/no-keyword-declarations.ts';

buildRuleTester().run('no-keyword-declarations', noKeywordDeclarations, {
    valid: ['const packageName = "example";', 'options.private = value;'],
    invalid: [
        ...['implements'].map((name) => ({
            code: `var ${name} = 0;`,
            errors: [{ messageId: 'keyword' as const, data: { name } }],
        })),
        {
            code: 'var package; function read() { let package; }',
            errors: [{ messageId: 'keyword' }, { messageId: 'keyword' }],
        },
    ],
});
