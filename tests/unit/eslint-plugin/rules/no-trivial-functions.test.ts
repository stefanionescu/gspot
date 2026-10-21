import { join } from 'node:path';
import plugin from '#eslint-plugin/plugin.ts';
import { createRuleTester } from '#tests/setup/rule-tester.ts';
import type { TrivialFunctionsOptions } from '#eslint-plugin/types/rules.ts';

createRuleTester().run<
    keyof (typeof plugin.rules)['no-trivial-functions']['meta']['messages'],
    [Partial<TrivialFunctionsOptions[0]>]
>('no-trivial-functions', plugin.rules['no-trivial-functions'], {
    valid: [
        'export function sort(items, compare = (a, b) => a - b) { items.sort(compare); return items; }',
        // A consumer that takes a function value needs the function declaration.
        'consume({ onValue: value => write(value) });',
        'handlers.onValue = value => write(value);',
        'items.map((item) => item.value);',
        'items.filter(function (item) { return item.active; });',
        'items.map(((item) => item.value) as (item: Item) => unknown);',
        'items.map(((item) => item.value)!);',
        'items.map(((item) => item.value) satisfies (item: Item) => unknown);',
        'consume(ready ? undefined : value => write(value));',
        'consume(fallback ?? (() => release()));',
        'const options = { onValue: ready ? undefined : value => write(value) }; consume(options);',
        'function factory() { setup(); configure(); return fallback ?? (() => release()); }',
        'consume(ready ? undefined : ((value => write(value)) as (value: Item) => void));',
        'const checks = [value => value.active]; checks.some(check => check(item));',
        'const checks = [((value) => value.active) as (value: Item) => boolean]; checks.some(check => check(item));',
        'function factory() { setup(); configure(); return () => release(); }',
        'const element = <Button onClick={() => submit()} />;',

        // A function includes its callback statements.
        'function process(items) { return items.map(item => { inspect(item); validate(item); return item; }); }',
        'function process(groups) { return groups.map(items => items.map(item => { inspect(item); validate(item); return item; })); }',
        'function process(items) { function visit(item) { inspect(item); validate(item); return item; } return items.map(visit); }',
        'const process = (items) => items.map(item => { inspect(item); validate(item); return item; });',

        // Over the limit.
        'function work() { first(); second(); third(); }',
        'function work() { if (ready) { first(); second(); } }',
        { code: 'function work() { first(); second(); }', options: [{ trivialFunctionStatements: 1 }] },

        // A declaration without a body has nothing to inline.
        'declare function required(): void;',
    ],
    invalid: [
        {
            code: 'function Row() { return <div />; } export function List() { setup(); configure(); return <Row />; }',
            errors: [{ messageId: 'trivial', line: 1, column: 1 }],
        },
        {
            code: 'function subscribe(listener) { return store.subscribe(listener); } subscribe(listener);',
            errors: [{ messageId: 'trivial', line: 1, column: 1 }],
        },
        {
            code: 'consume(ready ? undefined : value => write(value));\nconst local = value => value; local(item);',
            errors: [{ messageId: 'trivial', line: 2, column: 15 }],
        },
        {
            code: 'const checks = [value => value.active]; checks.some(check => check(item));\nconst local = value => value; local(item);',
            errors: [{ messageId: 'trivial', line: 2, column: 15 }],
        },
        {
            code: 'function count(n) { const count = value => value; return count(n); }',
            errors: [{ messageId: 'trivial', line: 1, column: 35 }],
        },
        {
            code: 'function local() { type Signature = typeof local; return 1; }',
            errors: [{ messageId: 'trivial' }],
        },
        {
            code: 'function count(n) { return n === 0 ? 0 : count(n - 1); }\nfunction local() { return 1; }',
            errors: [
                { messageId: 'trivial', line: 1, column: 1 },
                { messageId: 'trivial', line: 2, column: 1 },
            ],
        },
        {
            code: 'items.map((item) => item.value); function local() { return 1; }',
            errors: [{ messageId: 'trivial', line: 1, column: 34, endLine: 1, endColumn: 64 }],
        },
        {
            code: 'function isText(value: unknown): value is string { return typeof value === "string"; } function local() { return 1; }',
            errors: [
                { messageId: 'trivial', column: 1 },
                { messageId: 'trivial', column: 88 },
            ],
        },
        // An export, a second caller, a passed value, or a type predicate does not exempt a function.
        ...[
            'export class Settings { isEnabled() { return this.enabled; } }',
            'export class Panel { onClick = () => this.open(); }',
            'export default class Settings { isEnabled() { return this.enabled; } }',
            'class Settings { isEnabled() { return this.enabled; } } export { Settings };',
            'export const Panel = class { onClick = (() => this.open()) as () => void; };',
            'export function local() { return 1; }',
            'function local() { return 1; } export { local };',
            'export const local = () => 1;',
            'export default function local() { return 1; }',
            'function manyCallers() { return 1; } manyCallers(); manyCallers();',
            'const base = "root"; const path = file => join(base, file); path("first"); path("second");',
            'function callback() { update(); } on(callback); off(callback);',
            'function noop() {} export function build() { setup(); configure(); return noop; }',
            'function isText(value: unknown): value is string { return typeof value === "string"; }',
            'function assertText(value: unknown): asserts value is string { if (typeof value !== "string") throw new Error(); }',
        ].map((code) => ({ code, errors: [{ messageId: 'trivial' as const }] })),
        ...[
            'export const handler = ready ? () => first() : () => second();',
            'function subscribe(listener) { return store.subscribe(listener); } export function useValue() { return useSyncExternalStore(subscribe, getSnapshot); }',
        ].map((code) => ({ code, errors: [{ messageId: 'trivial' as const }, { messageId: 'trivial' as const }] })),
        ...[
            'function empty() {}',
            'function identity(value) { return value; } identity(1);',
            '(() => work())();',
            '(ready ? (() => work()) : fallback)();',
            '(fallback ?? (() => work()))();',
            '(function () { work(); })();',
            'const local = () => work(); local();',
            'function local() { return 1; } (local as () => number)();',
            'function local() { return 1; } local!();',
            'function local() { return 1; } (local satisfies () => number)();',
            'function local() { return 1; } type Signature = typeof local;',
            'const unused = (value) => value;',
            'const make = () => () => release();',
            '@decorate class A { method() { return 1; } }',
            'class A { method() { return 1; } }',
            'function one() { return 1; }',
            'function process(items) { return items.map(item => item); }',
            'function two() { first(); second(); }',
            'function comments() { /* one */\n\nreturn 1; /* two */ }',
            'const multiline = () => (\n first +\n second\n);',
            'function typed() { type Value = number; return 1; }',

            // Inline a local function at its only use.
            'function forward(value) { return owner(value); } forward(first);',
            'function callback(value) { return value.active; } items.filter(callback);',
            'const callback = (value) => value.active; items.filter(callback);',
            'function callback(a, b) { return a; } consume(callback.length);',
        ].map((code) => ({ code, errors: [{ messageId: 'trivial' as const }] })),
        // Methods, accessors, constructors, and recursive functions have names too.
        ...[
            'items.filter(function named(item) { return item.active; });',
            "export class NotFound extends Error { constructor() { super('Not found'); } }",
            'class A { constructor() { setup(); } } new A(); new A();',
            'const options = { nested: { onValue(value) { write(value); } } }; consume(options);',
            '(function count(n) { return n === 0 ? 0 : count(n - 1); })(2);',
            'function count(n) { return n === 0 ? 0 : count(n - 1); } count(2);',
            'const count = (n) => n === 0 ? 0 : count(n - 1); count(2);',
            'const count = function recurse(n) { return n === 0 ? 0 : recurse(n - 1); }; count(2);',
            'class A { constructor(public value: number) {} }',
            'class A { constructor(value: number) { this.value = value; } }',
            'class Failure extends Error { constructor(message: string) { super(message); this.name = "Failure"; } }',
            'class A { get value() { return 1; } }',
            'class A { set value(value) { store(value); } }',
            'class A { @decorate method() { return 1; } }',
            'class A extends B { override method() { return 1; } }',
        ].map((code) => ({ code, errors: [{ messageId: 'trivial' as const }] })),
        {
            code: 'const object = { get value() { return 1; }, set value(value) { store(value); } };',
            errors: [{ messageId: 'trivial' }, { messageId: 'trivial' }],
        },
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

// The rule reports a method that an interface or a base class declares like any other method.
createRuleTester({
    languageOptions: {
        parserOptions: {
            projectService: { allowDefaultProject: ['*.ts'] },
            tsconfigRootDir: import.meta.dir,
        },
    },
}).run<keyof (typeof plugin.rules)['no-trivial-functions']['meta']['messages'], [Partial<TrivialFunctionsOptions[0]>]>(
    'no-trivial-functions with type information',
    plugin.rules['no-trivial-functions'],
    {
        valid: [],
        invalid: [
            {
                filename: join(import.meta.dir, 'methods.ts'),
                code: [
                    'interface Runner { run(value: number): number; }',
                    'declare class Base { inherited(): number; }',
                    'class Task extends Base implements Runner {',
                    '    run(value: number): number { return value; }',
                    '    inherited(): number { return 1; }',
                    '    unnecessary(): number { return 1; }',
                    '    static run(value: number): number { return value; }',
                    '}',
                ].join('\n'),
                errors: [
                    { messageId: 'trivial', line: 4 },
                    { messageId: 'trivial', line: 5 },
                    { messageId: 'trivial', line: 6 },
                    { messageId: 'trivial', line: 7 },
                ],
            },
        ],
    },
);
