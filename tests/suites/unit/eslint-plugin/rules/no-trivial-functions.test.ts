import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import type { TrivialFunctionsOptions } from '#eslint-plugin/types/rules.ts';

buildRuleTester().run<
    keyof (typeof plugin.rules)['no-trivial-functions']['meta']['messages'],
    [Partial<TrivialFunctionsOptions[0]>]
>('no-trivial-functions', plugin.rules['no-trivial-functions'], {
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
    ],
    invalid: [
        ...[
            'function Row() { return <div />; } export function List() { setup(); configure(); return <Row />; }',
            'function count(n) { return n === 0 ? 0 : count(n - 1); }',
            'const count = (n) => n === 0 ? 0 : count(n - 1); count(2);',
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
            'export function local() { return 1; }',
            'function local() { return 1; } export { local };',
            'export const local = () => 1;',
            'export default function local() { return 1; }',
            'function noop() {} export function build() { setup(); configure(); return noop; }',
        ].map((code) => ({ code, errors: [{ messageId: 'trivial' as const }] })),
        ...[
            'export const handler = ready ? () => first() : () => second();',
            'function subscribe(listener) { return store.subscribe(listener); } export function useValue() { return useSyncExternalStore(subscribe, getSnapshot); }',
        ].map((code) => ({ code, errors: [{ messageId: 'trivial' as const }, { messageId: 'trivial' as const }] })),
        {
            code: 'function outer() { function inner() {} }',
            errors: [{ messageId: 'trivial' }, { messageId: 'trivial' }],
        },
        {
            code: 'function three() { first(); second(); third(); }',
            options: [{ trivialFunctionStatements: 3 }],
            errors: [{ messageId: 'trivial' }],
        },
    ],
});

buildRuleTester().run<
    keyof (typeof plugin.rules)['no-trivial-functions']['meta']['messages'],
    [Partial<TrivialFunctionsOptions[0]>]
>('no-trivial-functions overloads and framework exports', plugin.rules['no-trivial-functions'], {
    valid: [
        'function parse(value: string): number;\nfunction parse(value: number): number;\nfunction parse(value: unknown) { return Number(value); }',
        'export function parse(value: string): number;\nexport function parse(value: number): number;\nexport function parse(value: unknown) { return Number(value); }',
        'class Parser { parse(value: string): number;\nparse(value: number): number;\nparse(value: unknown) { return Number(value); } }',
        ...(
            [
                ['/repo/app/items/route.ts', 'export async function GET() { return Response.json(items); }'],
                [
                    '/repo/app/items/route.ts',
                    'export const POST = async (request: Request) => Response.json(await request.json());',
                ],
                ['/repo/app/page.tsx', 'export default function Page() { return <main />; }'],
                ['/repo/app/page.tsx', 'export async function generateMetadata() { return { title: "Items" }; }'],
            ] as const
        ).map(([filename, code]) => ({
            code,
            filename,
            options: [
                {
                    exportNames: [
                        { files: ['**/app/**/route.ts'], names: ['GET', 'POST'] },
                        { files: ['**/app/**/page.tsx'], names: ['default', 'generateMetadata'] },
                    ],
                },
            ] as const,
        })),
    ],
    invalid: [
        {
            code: 'export async function GET() { return Response.json(items); }',
            filename: '/repo/lib/items.ts',
            options: [{ exportNames: [{ files: ['**/app/**/route.ts'], names: ['GET'] }] }],
            errors: [{ messageId: 'trivial', data: { name: "async function 'GET'", statements: '1 statement' } }],
        },
        {
            code: 'export async function PUT() { return Response.json(items); }',
            filename: '/repo/app/items/route.ts',
            options: [{ exportNames: [{ files: ['**/app/**/route.ts'], names: ['GET'] }] }],
            errors: [{ messageId: 'trivial', data: { name: "async function 'PUT'", statements: '1 statement' } }],
        },
        {
            code: 'async function GET() { return Response.json(items); }\nGET();',
            filename: '/repo/app/items/route.ts',
            options: [{ exportNames: [{ files: ['**/app/**/route.ts'], names: ['GET'] }] }],
            errors: [{ messageId: 'trivial' }],
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
