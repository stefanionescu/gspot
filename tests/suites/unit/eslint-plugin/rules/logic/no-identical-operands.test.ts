import { noIdenticalOperands } from '#eslint-plugin/rules/logic/no-identical-operands.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-identical-operands', noIdenticalOperands, {
    valid: [
        'value + value;',
        'value === value;',
        '1 << 1; 1n << 1n;',
        'first - second;',
        'read(first) === read(second);',
    ],
    invalid: [
        { code: 'value && value;', errors: [{ messageId: 'operands' }] },
        { code: 'value << value;', errors: [{ messageId: 'operands' }] },
        { code: '2n << 2n;', errors: [{ messageId: 'operands' }] },
        { code: 'read() === read();', errors: [{ messageId: 'operands' }] },
        { code: '(first + second) - (first /* explanation */ + second);', errors: [{ messageId: 'operands' }] },
    ],
});
