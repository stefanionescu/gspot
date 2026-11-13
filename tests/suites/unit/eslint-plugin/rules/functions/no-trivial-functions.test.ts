import { noTrivialFunctions } from '#eslint-plugin/rules/functions/no-trivial-functions.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-trivial-functions', noTrivialFunctions, {
    valid: [
        'consume({ onValue: value => write(value) });',
        'handlers.onValue = value => write(value);',
        'items.map((item) => item.value);',
        'items.map(((item) => item.value) as (item: Item) => unknown);',
        'const options = { onValue: ready ? undefined : value => write(value) }; consume(options);',
        'function factory() { setup(); configure(); return fallback ?? (() => release()); }',
        'const element = <Button onClick={() => submit()} />;',
        'function process(items) { return items.map(item => { inspect(item); validate(item); return item; }); }',
        'class A { constructor(public value: number) {} }',
        'class A { @decorate method() { return 1; } }',
        'function format(count) { return String(count); } write(format(1)); write(format(2));',
        'const format = (count) => String(count); write(format(1)); consume(format);',
        'export function local() { return 1; }',
        'function local() { return 1; } export { local };',
        'export default function local() { return 1; }',
        'export const handler = ready ? () => first() : () => second();',
        'function parse(value: string): number;\nfunction parse(value: number): number;\nfunction parse(value: unknown) { return Number(value); }',
        'class Parser { parse(value: string): number;\nparse(value: number): number;\nparse(value: unknown) { return Number(value); } }',
    ],
    invalid: [
        ...[
            'export class Panel { onClick = () => this.open(); }',
            'class A { constructor(value: number) { this.value = value; } }',
            'const make = () => () => release();',
        ].map((code) => ({ code, errors: [{ messageId: 'trivial' as const }] })),
        {
            code: 'function count(n) { const count = value => value; return count(n); }',
            errors: [
                {
                    messageId: 'trivial',
                    data: { name: "arrow function 'count'", statements: '1 statement' },
                    line: 1,
                    column: 35,
                },
            ],
        },
        {
            code: 'function empty() {}',
            errors: [{ messageId: 'trivial', data: { name: "function 'empty'", statements: '0 statements' } }],
        },
        ...['(() => work())();', 'function format(count) { return String(count); } write(format(1));'].map((code) => ({
            code,
            errors: [{ messageId: 'trivial' as const }],
        })),
        {
            code: 'function three() { first(); second(); third(); }',
            options: [{ trivialFunctionStatements: 3 }],
            errors: [{ messageId: 'trivial', data: { name: "function 'three'", statements: '3 statements' } }],
        },
        {
            code: 'declare function parse(value: string): number;\nfunction other(value: unknown) { return Number(value); }',
            errors: [{ messageId: 'trivial', data: { name: "function 'other'", statements: '1 statement' } }],
        },
        {
            code: 'class Parser { parse(value: string): number;\nformat(value: unknown) { return String(value); } }',
            errors: [{ messageId: 'trivial', data: { name: "method 'format'", statements: '1 statement' } }],
        },
    ],
});
