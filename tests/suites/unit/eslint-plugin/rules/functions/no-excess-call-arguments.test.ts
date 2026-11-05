import { noExcessCallArguments } from '#eslint-plugin/rules/functions/no-excess-call-arguments.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-excess-call-arguments', noExcessCallArguments, {
    valid: [
        'function read(value) { return value; } read(); read(1);',
        'function read(...values) { return values; } read(1, 2);',
        'function read() {} read(1, 2);',
        'const read = function() {}; read(1);',
        'const read = () => {}; read(1);',
        'function read() { return arguments[0]; } read(1, 2);',
        'function read() { return (() => arguments[0])(); } read(1, 2);',
        'function read(value) { return value; } const alias = read; alias(1, 2);',
        'const api = { read(value) { return value; } }; api.read(1, 2);',
        'import read from "reader"; read(1, 2);',
        'function read(value: string): void; function read(value: number): void; function read(value: unknown) {} read(1, 2);',
        'function run(callback: (first: number, second: number) => number) { return callback(1, 2); }',
        'function run({ visit }) { return visit(1, 2); }',
    ],
    invalid: [
        { code: 'function read(value) { return value; } read(1, 2);', errors: [{ messageId: 'arguments' }] },
        { code: 'function read() { work(); } read(...values);', errors: [{ messageId: 'arguments' }] },
        { code: 'const read = (value) => value; read(1, 2);', errors: [{ messageId: 'arguments' }] },
        { code: '(function(value) { return value; })(1, 2);', errors: [{ messageId: 'arguments' }] },
        { code: '((value) => value)(1, 2);', errors: [{ messageId: 'arguments' }] },
        {
            code: 'function read() { function nested() { return arguments[0]; } work(); } read(1);',
            errors: [{ messageId: 'arguments' }],
        },
        {
            code: 'function read() { const arguments = []; work(arguments); } read(1);',
            errors: [{ messageId: 'arguments' }],
        },
        {
            code: 'declare function read(value: string): void; read("one", "two");',
            errors: [{ messageId: 'arguments' }],
        },
    ],
});
