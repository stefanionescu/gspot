import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-identical-operands', plugin.rules['no-identical-operands'], {
    valid: [
        'value + value; value * value; value ** value;',
        'value === value; value !== value; value == value; value != value;',
        '1 << 1; 1n << 1n; 0x1 << 0x1;',
        'first - second;',
        'read(first) === read(second);',
    ],
    invalid: [
        { code: 'value - value;', errors: [{ messageId: 'operands' }] },
        { code: 'value && value; value || value;', errors: [{ messageId: 'operands' }, { messageId: 'operands' }] },
        {
            code: 'value < value; value <= value; value > value; value >= value;',
            errors: [
                { messageId: 'operands' },
                { messageId: 'operands' },
                { messageId: 'operands' },
                { messageId: 'operands' },
            ],
        },
        { code: 'value << value; value >> value;', errors: [{ messageId: 'operands' }, { messageId: 'operands' }] },
        { code: '2n << 2n;', errors: [{ messageId: 'operands' }] },
        { code: 'read() === read();', errors: [{ messageId: 'operands' }] },
        { code: '(first + second) - (first /* explanation */ + second);', errors: [{ messageId: 'operands' }] },
    ],
});
