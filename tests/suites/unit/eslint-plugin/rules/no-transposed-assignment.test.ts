import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-transposed-assignment', plugin.rules['no-transposed-assignment'], {
    valid: [
        'count += increment;',
        'count -= increment;',
        'count = +increment;',
        'count=+increment;',
        'count =+increment;',
        'count = + increment;',
        'ready = ! value;',
        'const count = - value;',
        'count = (+ value);',
        'count=/* comment */+ value;',
        'count =\n+ value;',
        'count = ~ value;',
        'count += + value;',
    ],
    invalid: [
        { code: 'count =+ increment;', errors: [{ messageId: 'operator' }] },
        { code: 'count =- increment;', errors: [{ messageId: 'operator' }] },
        { code: 'ready =! value;', errors: [{ messageId: 'operator' }] },
        { code: 'const count =+ value;', errors: [{ messageId: 'operator' }] },
        { code: 'count =+\nvalue;', errors: [{ messageId: 'operator' }] },
        { code: 'count =+/* comment */value;', errors: [{ messageId: 'operator' }] },
        { code: 'count =+(value);', errors: [{ messageId: 'operator' }] },
    ],
});
