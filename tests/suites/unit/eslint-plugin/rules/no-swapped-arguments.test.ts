import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester, buildTypedRuleTester } from '#tests/setup/eslint/rule-tester.ts';

const rule = plugin.rules['no-swapped-arguments'];

buildRuleTester().run('no-swapped-arguments', rule, {
    valid: [
        'function divide(dividend, divisor) {} divide(dividend, divisor);',
        'function divide(dividend, divisor) {} if (dividend < divisor) divide(divisor, dividend);',
        'function compare(a, b) {} list.sort((a, b) => compare(b, a));',
        'function compare(a, b) {} const order = { reverse: compare(b, a) };',
        'function compare(a, b) {} const result = a < b ? compare(b, a) : compare(a, b);',
        'function ff(a, b, c, d) {} ff(d, a, b, c);',
        'divide(divisor, dividend);',
    ],
    invalid: [
        {
            code: 'function divide(dividend, divisor) {} divide(divisor, dividend);',
            errors: [
                { messageId: 'swapped', data: { first: 'divisor', second: 'dividend' }, column: 46, endColumn: 63 },
            ],
        },
        {
            code: 'class Point { constructor(x, y) {} } function shift(x, y) {} function move(x, y) { new Point(y, x); shift(y, x); }',
            errors: [{ messageId: 'swapped', data: { first: 'y', second: 'x' }, column: 107 }],
        },
        {
            code: 'function span(start, end, step) {} span(step, end, start);',
            errors: [{ messageId: 'swapped', data: { first: 'step', second: 'start' } }],
        },
    ],
});

buildTypedRuleTester().run('no-swapped-arguments', rule, {
    valid: [
        'function divide(dividend: number, divisor: string) {} declare const dividend: number; declare const divisor: number; divide(divisor as never, dividend);',
        'function divide(dividend: number, divisor: number) {} declare const dividend: number; declare const divisor: number; divide(dividend, divisor);',
    ],
    invalid: [
        {
            code: 'declare const x: number; declare const y: number; Math.pow(y, x);',
            errors: [{ messageId: 'swapped', data: { first: 'y', second: 'x' } }],
        },
        {
            code: 'class Point { constructor(x: number, y: number) {} } declare const x: number; declare const y: number; new Point(y, x);',
            errors: [{ messageId: 'swapped' }],
        },
    ],
});
