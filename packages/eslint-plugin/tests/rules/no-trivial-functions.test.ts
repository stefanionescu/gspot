import { tester } from '#plugin-tests/harness/tester.ts';
import { noTrivialFunctions } from '#plugin/rules/no-trivial-functions.ts';

tester().run('no-trivial-functions', noTrivialFunctions, {
    valid: [
        'function add(a, b) { return a + b; }',
        'function run(a) { log(a); return build(a, 1); }',
        'const f = (a) => a.trim();',
        'function keep(a) { validate(a); return build(a); }',
        { code: 'function wide(a, b) { first(a); second(b); third(a); }', options: [{ maxStatements: 2 }] },
        'export default (a) => build(a);',
        'function collect(...items) { return build(items); }',
        'function expand(items) { return build(...items); }',
    ],
    invalid: [
        {
            code: 'function forward(a, b) { return build(a, b); }',
            errors: [{ messageId: 'trivial', data: { name: 'forward', callee: 'build' } }],
        },
        { code: 'function fire(a) { build(a); }', errors: [{ messageId: 'trivial' }] },
        {
            code: 'const forward = (a) => build(a);',
            errors: [{ messageId: 'trivial', data: { name: 'forward', callee: 'build' } }],
        },
        { code: 'const forward = async (a) => await build(a);', errors: [{ messageId: 'trivial' }] },
        { code: 'function forward(...rest) { return build(...rest); }', errors: [{ messageId: 'trivial' }] },
        {
            code: 'class A { make(a) { return new Maker(a); } }',
            errors: [{ messageId: 'trivial', data: { name: 'make', callee: 'Maker' } }],
        },
    ],
});
