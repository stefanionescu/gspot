import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noNestedTemplateLiterals } from '#eslint-plugin/rules/structure/no-nested-template-literals.ts';

buildRuleTester().run('no-nested-template-literals', noNestedTemplateLiterals, {
    valid: ['const text = `value ${name}`;', 'const text = `outer\n${`inner ${name}`}\nend`;'],
    invalid: [
        { code: 'const text = `outer ${`inner ${name}`}`;', errors: [{ messageId: 'template' }] },
        { code: 'const text = `outer\n${`inner\n${name}`}`;', errors: [{ messageId: 'template' }] },
        {
            code: 'const text = `outer ${`middle ${`inner ${name}`}`}`;',
            errors: [{ messageId: 'template' }, { messageId: 'template' }],
        },
    ],
});
