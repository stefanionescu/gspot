import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import type { TrivialFunctionsOptions } from '#eslint-plugin/types/functions.ts';
import { noTrivialFunctions } from '#eslint-plugin/rules/functions/no-trivial-functions.ts';

buildRuleTester().run<keyof (typeof noTrivialFunctions)['meta']['messages'], [Partial<TrivialFunctionsOptions[0]>]>(
    'no-trivial-functions',
    noTrivialFunctions,
    {
        valid: [
            'export function sort(items, compare = (a, b) => a - b) { items.sort(compare); return items; }',
            'consume({ onValue: value => write(value) });',
            'handlers.onValue = value => write(value);',
            'items.map((item) => item.value);',
            'items.filter(function (item) { return item.active; });',
            'items.map(((item) => item.value) as (item: Item) => unknown);',
            'consume(fallback ?? (() => release()));',
            'const options = { onValue: ready ? undefined : value => write(value) }; consume(options);',
            'function factory() { setup(); configure(); return fallback ?? (() => release()); }',
            'const element = <Button onClick={() => submit()} />;',
            'function process(items) { return items.map(item => { inspect(item); validate(item); return item; }); }',
            'const process = (items) => items.map(item => { inspect(item); validate(item); return item; });',
            { code: 'function work() { first(); second(); }', options: [{ trivialFunctionStatements: 1 }] },
            'declare function required(): void;',
            'class A { constructor(public value: number) {} }',
            'class A { @decorate method() { return 1; } }',
            'const options = { nested: { onValue(value) { write(value); } } }; consume(options);',
            'function format(count) { return String(count); } write(format(1)); write(format(2));',
            'const format = (count) => String(count); write(format(1)); consume(format);',
            'const count = (n) => n === 0 ? 0 : count(n - 1); count(2);',
            'export function local() { return 1; }',
            'function local() { return 1; } export { local };',
            'function local() { return 1; } export default local;',
            'export const local = () => 1;',
            'export default function local() { return 1; }',
            'export const handler = ready ? () => first() : () => second();',
        ],
        invalid: [
            ...[
                'function Row() { return <div />; } export function List() { setup(); configure(); return <Row />; }',
                'function count(n) { return n === 0 ? 0 : count(n - 1); }',
                'const count = function recurse(n) { return n === 0 ? 0 : recurse(n - 1); }; count(2);',
                '(function count(n) { return n === 0 ? 0 : count(n - 1); })(2);',
                'function assertText(value: unknown): asserts value is string { if (typeof value !== "string") throw new Error(); }',
                'export class Settings { isEnabled() { return this.enabled; } }',
                'export class Panel { onClick = () => this.open(); }',
                'export const Panel = class { onClick = (() => this.open()) as () => void; };',
                'export class Lock { [Symbol.dispose](): void { release(this); } }',
                'class A { constructor(value: number) { this.value = value; } }',
                'class Failure extends Error { constructor(message: string) { super(message); this.name = "Failure"; } }',
                'const multiline = () => (\n first +\n second\n);',
                'const make = () => () => release();',
            ].map((code) => ({ code, errors: [{ messageId: 'trivial' as const }] })),
            {
                code: 'consume(ready ? undefined : value => write(value));\nconst local = value => value; local(item);',
                errors: [{ messageId: 'trivial', line: 2, column: 15 }],
            },
            {
                code: 'function count(n) { const count = value => value; return count(n); }',
                errors: [{ messageId: 'trivial', line: 1, column: 35 }],
            },
            {
                code: 'function isText(value: unknown): value is string { return typeof value === "string"; } function local() { return 1; }',
                errors: [
                    { messageId: 'trivial', column: 1 },
                    { messageId: 'trivial', column: 88 },
                ],
            },
            ...[
                'function empty() {}',
                '(() => work())();',
                '(ready ? (() => work()) : fallback)();',
                '(function () { work(); })();',
                'function local() { type Signature = typeof local; return 1; }',
                'function noop() {} export function build() { setup(); configure(); return noop; }',
                'function subscribe(listener) { return store.subscribe(listener); } export function useValue() { return useSyncExternalStore(subscribe, getSnapshot); }',
                'function format(count) { return String(count); } write(format(1));',
                'function unused() { return 1; }',
            ].map((code) => ({ code, errors: [{ messageId: 'trivial' as const }] })),
            {
                code: 'function outer() { function inner() {} }',
                errors: [{ messageId: 'trivial' }, { messageId: 'trivial' }],
            },
            {
                code: 'function three() { first(); second(); third(); }',
                options: [{ trivialFunctionStatements: 3 }],
                errors: [{ messageId: 'trivial' }],
            },
            { code: 'function a() { return 1; }', settings: { gspot: {} }, errors: [{ messageId: 'trivial' }] },
            {
                code: 'function run() { declare const a: number; read(); return a; }',
                errors: [{ messageId: 'trivial' }],
            },
        ],
    },
);

buildRuleTester().run<keyof (typeof noTrivialFunctions)['meta']['messages'], [Partial<TrivialFunctionsOptions[0]>]>(
    'no-trivial-functions overloads and exports',
    noTrivialFunctions,
    {
        valid: [
            'function parse(value: string): number;\nfunction parse(value: number): number;\nfunction parse(value: unknown) { return Number(value); }',
            'export function parse(value: string): number;\nexport function parse(value: number): number;\nexport function parse(value: unknown) { return Number(value); }',
            'class Parser { parse(value: string): number;\nparse(value: number): number;\nparse(value: unknown) { return Number(value); } }',
            'export async function GET() { return Response.json(items); }',
            'export const POST = async (request: Request) => Response.json(await request.json());',
            'export default function Page() { return <main />; }',
        ],
        invalid: [
            {
                code: 'async function GET() { return Response.json(items); }\nGET();',
                errors: [{ messageId: 'trivial', data: { name: "async function 'GET'", statements: '1 statement' } }],
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
    },
);
