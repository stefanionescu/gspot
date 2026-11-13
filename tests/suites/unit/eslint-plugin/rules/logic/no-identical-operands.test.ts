import { noIdenticalOperands } from '#eslint-plugin/rules/logic/no-identical-operands.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-identical-operands', noIdenticalOperands, {
    valid: ['value + value;', 'value === value;', '1 << 1;', 'first - second;'],
    invalid: [
        { code: 'value && value;', errors: [{ messageId: 'operands', data: { operator: '&&' } }] },
        { code: 'value << value;', errors: [{ messageId: 'operands', data: { operator: '<<' } }] },
        { code: '2n << 2n;', errors: [{ messageId: 'operands', data: { operator: '<<' } }] },
        { code: 'read() === read();', errors: [{ messageId: 'operands', data: { operator: '===' } }] },
        {
            code: '(first + second) - (first /* explanation */ + second);',
            errors: [{ messageId: 'operands', data: { operator: '-' } }],
        },
    ],
});
