import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noExcessCallArguments } from '#eslint-plugin/rules/functions/no-excess-call-arguments.ts';

buildRuleTester().run('no-excess-call-arguments', noExcessCallArguments, {
    valid: [
        'function read(value) { return value; } read(); read(1);',
        'function read(...values) { return values; } read(1, 2);',
        'const read = () => {}; read(1);',
        'function read() { return arguments[0]; } read(1, 2);',
        'function read() { return (() => arguments[0])(); } read(1, 2);',
        'function read(value: string): void; function read(value: number): void; function read(value: unknown) {} read(1, 2);',
        'function run({ visit }) { return visit(1, 2); }',
    ],
    invalid: [
        {
            code: 'function read(value) { return value; } read(1, 2);',
            errors: [{ messageId: 'arguments', data: { parameters: 1, arguments: 2 } }],
        },
        {
            code: 'const read = (value) => value; read(1, 2);',
            errors: [{ messageId: 'arguments', data: { parameters: 1, arguments: 2 } }],
        },
        {
            code: '(function(value) { return value; })(1, 2);',
            errors: [{ messageId: 'arguments', data: { parameters: 1, arguments: 2 } }],
        },
        {
            code: 'function read() { function nested() { return arguments[0]; } work(); } read(1);',
            errors: [{ messageId: 'arguments', data: { parameters: 0, arguments: 1 } }],
        },
        {
            code: 'function read() { const arguments = []; work(arguments); } read(1);',
            errors: [{ messageId: 'arguments', data: { parameters: 0, arguments: 1 } }],
        },
        {
            code: 'declare function read(value: string): void; read("one", "two");',
            errors: [{ messageId: 'arguments', data: { parameters: 1, arguments: 2 } }],
        },
    ],
});
