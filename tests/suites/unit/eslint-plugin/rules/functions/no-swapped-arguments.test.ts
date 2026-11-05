import { noSwappedArguments } from '#eslint-plugin/rules/functions/no-swapped-arguments.ts';
import { buildRuleTester, buildTypedRuleTester } from '#tests/setup/eslint/rule-tester.ts';

const rule = noSwappedArguments;

buildRuleTester().run('no-swapped-arguments', rule, {
    valid: [
        'function divide(dividend, divisor) {} divide(dividend, divisor);',
        'function divide(dividend, divisor) {} if (dividend < divisor) divide(divisor, dividend);',
        'function compare(a, b) {} list.sort((a, b) => compare(b, a));',
        'function compare(a, b) {} const order = { reverse: compare(b, a) };',
        'function compare(a, b) {} const result = a < b ? compare(b, a) : compare(a, b);',
        'function compare(a, b) {} const result = a < b ? compare(b, a) : 0;',
        'function ff(a, b, c, d) {} ff(d, a, b, c);',
        'divide(divisor, dividend);',
        'function compare(left, right, order) { return order(right, left); }',
        'function compare(a, b) {} list.sort((a, b) => { return compare(b, a); });',
        'function compare(a, b) {} const result = a < b ? compare(a, b) : compare(b, a);',
        'function range(start, end) {} if (!start.isBefore(end)) range(end, start);',
        'function merge(first, second) {} if (first.length > second.length) merge(second, first);',
        'function split({ head }, tail) {} split(tail, head);',
        'function asc(a, b) {} function desc(a, b) { return asc(b, a); }',
        'function mid(lo, hi) { return lo > hi ? mid(hi, lo) : 0; }',
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
        ...[
            'function divide(dividend = 1, divisor = 2) {} divide(divisor, dividend);',
            'function ff(a, b, c, d) {} ff(d, 1, c, a);',
            'function divide(dividend, divisor) {} if (ready) divide(divisor, dividend);',
            'function divide(dividend, divisor) {} if (0 < divisor) divide(divisor, dividend);',
            'function divide(dividend, divisor) {} if (dividend + divisor) divide(divisor, dividend);',
            'function compare(left, right) {} list.sort((left, right) => compare(right, left));',
        ].map((code) => ({ code, errors: [{ messageId: 'swapped' as const }] })),
    ],
});

buildTypedRuleTester().run('no-swapped-arguments', rule, {
    valid: [
        'function divide(dividend: number, divisor: string) {} declare const dividend: number; declare const divisor: number; divide(divisor as never, dividend);',
        'function divide(dividend: number, divisor: number) {} declare const dividend: number; declare const divisor: number; divide(dividend, divisor);',
        'function pair(left: string, right: number) {} declare const left: number; declare const right: string; pair(right, left);',
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
