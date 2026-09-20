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
        'const arrow = (a) => a.trim();',
        'const reorder = (a, b) => build(b, a);',
        'const collect = (...items) => build(items);',
        'const spread = (items) => build(...items);',
        'function defaults(a = 1) { return build(a); }',
        'export default (a) => build(a);',
        'items.map((item) => build(item));',
        {
            code: 'const keep = (a) => build(a);',
            filename: '/repo/src/openapi/components.ts',
            options: [{ allow: ['src/openapi/components.ts:keep'] }],
        },
        {
            code: 'class Adapter { keep(a) { return build(a); } }',
            filename: '/repo/src/openapi/components.ts',
            options: [{ allow: ['src/openapi/components.ts:keep'] }],
        },
    ],
    invalid: [
        {
            code: 'function forward(a, b) { return build(a, b); }',
            errors: [{ messageId: 'callThrough', data: { name: 'forward', callee: 'build' } }],
        },
        { code: 'function fire(a) { build(a); }', errors: [{ messageId: 'callThrough' }] },
        { code: 'const forward = (a) => build(a);', errors: [{ messageId: 'callThrough' }] },
        { code: 'const forward = async (a) => await build(a);', errors: [{ messageId: 'callThrough' }] },
        { code: 'const forward = (a) => { return build(a); };', errors: [{ messageId: 'callThrough' }] },
        { code: 'const forward = function (a) { return build(a); };', errors: [{ messageId: 'callThrough' }] },
        { code: 'function forward(...items) { return build(...items); }', errors: [{ messageId: 'callThrough' }] },
        { code: 'const factory = (a) => new Maker(a);', errors: [{ messageId: 'callThrough' }] },
        {
            code: 'class Adapter { make(a) { return new Maker(a); } }',
            errors: [{ messageId: 'callThrough', data: { name: 'make', callee: 'Maker' } }],
        },
        { code: 'const adapter = { make(a) { return build(a); } };', errors: [{ messageId: 'callThrough' }] },
        { code: 'const adapter = { "make": (a) => build(a) };', errors: [{ messageId: 'callThrough' }] },
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
