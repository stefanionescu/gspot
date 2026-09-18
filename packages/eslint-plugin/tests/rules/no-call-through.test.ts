import { tester } from '#plugin-tests/harness/tester.ts';
import { noCallThrough } from '#plugin/rules/no-call-through.ts';

tester().run('no-call-through', noCallThrough, {
    valid: [
        'function add(a, b) { return a + b; }',
        'function reorder(a, b) { return build(b, a); }',
        'function narrow(a) { return build(a, true); }',
        'function twice(a) { log(a); return build(a); }',
        {
            code: 'function keep(a) { return build(a); }',
            filename: '/repo/src/openapi/components.ts',
            options: [{ allow: ['src/openapi/components.ts:keep'] }],
        },
        'const arrow = (a) => build(a);',
    ],
    invalid: [
        {
            code: 'function forward(a, b) { return build(a, b); }',
            errors: [{ messageId: 'callThrough', data: { name: 'forward', callee: 'build' } }],
        },
        { code: 'function forward(a = 1) { build(a); }', errors: [{ messageId: 'callThrough' }] },
        { code: 'async function forward(a) { return await build(a); }', errors: [{ messageId: 'callThrough' }] },
        { code: 'function forward(a) { return build(a) as string; }', errors: [{ messageId: 'callThrough' }] },
        {
            code: 'function forward(a) { return build(a); }',
            filename: '/repo/src/other.ts',
            options: [{ allow: ['src/openapi/components.ts:forward'] }],
            errors: [{ messageId: 'callThrough' }],
        },
    ],
});
