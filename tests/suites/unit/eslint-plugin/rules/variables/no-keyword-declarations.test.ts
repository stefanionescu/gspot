import { noKeywordDeclarations } from '#eslint-plugin/rules/variables/no-keyword-declarations.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-keyword-declarations', noKeywordDeclarations, {
    valid: ['const packageName = "example";'],
    invalid: [
        {
            code: 'var package; function read() { let package; }',
            errors: [
                { messageId: 'keyword', data: { name: 'package' } },
                { messageId: 'keyword', data: { name: 'package' } },
            ],
        },
    ],
});
