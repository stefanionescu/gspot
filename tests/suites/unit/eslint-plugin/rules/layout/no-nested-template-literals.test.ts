import { noNestedTemplateLiterals } from '#eslint-plugin/rules/layout/no-nested-template-literals.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-nested-template-literals', noNestedTemplateLiterals, {
    valid: ['const text = `value ${name}`;', 'const text = `outer\n${`inner ${name}`}\nend`;'],
    invalid: [
        { code: 'const text = `outer ${`inner\n${name}`}\nend`;', errors: [{ messageId: 'template' }] },
        { code: 'const text = `outer\n${`inner\n${name}`}`;', errors: [{ messageId: 'template' }] },
    ],
});
