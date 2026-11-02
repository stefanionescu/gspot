import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-nested-template-literals', plugin.rules['no-nested-template-literals'], {
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
