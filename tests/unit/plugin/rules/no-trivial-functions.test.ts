import { tester } from '#tests/support/plugin/tester.ts';
import { noTrivialFunctions } from '#plugin/rules/no-trivial-functions.ts';

tester().run('no-trivial-functions', noTrivialFunctions, {
    valid: [
        // A function written where the consumer takes a function value has nothing to be inlined into.
        'consume({ onValue: value => write(value) });',
        'const options = { onValue: value => write(value) }; consume(options);',
        'const options = { nested: { onValue(value) { write(value); } } }; consume(options);',
        'const local = { onValue: value => write(value) }; local.onValue(1);',
        'handlers.onValue = value => write(value);',
        'items.map((item) => item.value);',
        'items.filter(function (item) { return item.active; });',
        'items.filter(function named(item) { return item.active; });',
        'items.map(((item) => item.value) as (item: Item) => unknown);',
        'items.map(((item) => item.value)!);',
        'items.map(((item) => item.value) satisfies (item: Item) => unknown);',
        'const checks = [value => value.active]; checks.some(check => check(item));',
        '[value => value.active].some(check => check(item));',
        'const checks = [((value) => value.active) as (value: Item) => boolean]; checks.some(check => check(item));',
        'function factory() { setup(); configure(); return () => release(); }',
        'const element = <Button onClick={() => submit()} />;',

        // The callbacks a function writes inside itself are its statements.
        'function process(items) { return items.map(item => { inspect(item); validate(item); return item; }); }',
        'function process(groups) { return groups.map(items => items.map(item => { inspect(item); validate(item); return item; })); }',
        'function process(items) { function visit(item) { inspect(item); validate(item); return item; } return items.map(visit); }',
        'const process = (items) => items.map(item => { inspect(item); validate(item); return item; });',

        // Recursion names the binding inside the body.
        '(function count(n) { return n === 0 ? 0 : count(n - 1); })(2);',
        'function count(n) { return n === 0 ? 0 : count(n - 1); } count(2);',
        'const count = (n) => n === 0 ? 0 : count(n - 1); count(2);',
        'const count = function recurse(n) { return n === 0 ? 0 : recurse(n - 1); }; count(2);',

        // Over the limit.
        'function work() { first(); second(); third(); }',
        'function work() { if (ready) { first(); second(); } }',
        { code: 'function work() { first(); second(); }', options: [{ maxStatements: 1 }] },

        // Declared signatures the language owns.
        'declare function required(): void;',
        'function isText(value: unknown): value is string { return typeof value === "string"; }',
        'function assertText(value: unknown): asserts value is string { if (typeof value !== "string") throw new Error(); }',
        'class A { constructor(public value: number) {} }',
        'class A { constructor(value: number) { this.value = value; } }',
        'class Failure extends Error { constructor(message: string) { super(message); this.name = "Failure"; } }',
        'class A { get value() { return 1; } }',
        'class A { set value(value) { store(value); } }',
        'class A { @decorate method() { return 1; } }',
        'class A extends B { override method() { return 1; } }',
        'const object = { get value() { return 1; }, set value(value) { store(value); } };',

        '// eslint-disable-next-line @rule-tester/no-trivial-functions -- reason: External callback requires this signature.\nconst callback = () => 1;',
    ],
    invalid: [
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
            errors: [{ messageId: 'trivial', line: 2, column: 1 }],
        },
        {
            code: 'items.map((item) => item.value); function local() { return 1; }',
            errors: [{ messageId: 'trivial', line: 1, column: 34, endLine: 1, endColumn: 64 }],
        },
        {
            code: 'function isText(value: unknown): value is string { return typeof value === "string"; } function local() { return 1; }',
            errors: [{ messageId: 'trivial', column: 88 }],
        },
        ...[
            'function empty() {}',
            'function identity(value) { return value; } identity(1);',
            '(() => work())();',
            '[() => work()][0]();',
            '([() => work()] as (() => void)[])[0]();',
            '(function () { work(); })();',
            'const local = () => work(); local();',
            'function local() { return 1; } (local as () => number)();',
            'function local() { return 1; } local!();',
            'function local() { return 1; } (local satisfies () => number)();',
            'export function local() { return 1; }',
            'function local() { return 1; } export { local };',
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
            'class A { constructor() {} }',
            'class A extends B { constructor() { super(); } }',
            'function typed() { type Value = number; return 1; }',

            // A name does not save a small function: inline it where it is called or passed.
            'function manyCallers() { return 1; } manyCallers(); manyCallers();',
            'function forward(value) { return owner(value); } forward(first); forward(second);',
            'function path(base, file) { return join(base, file); } path(first, value); path(second, value);',
            'const base = "root"; const path = file => join(base, file); path("first"); path("second");',
            'function area(width, height) { return width * height; } area(2, 3); area(4, 5);',
            'function heading(title) { return `# ${title}`; } heading(first); heading(second);',
            'function schema(properties) { return { type: "object", properties }; } schema(first); schema(second);',
            'function normalize(path) { return separator === "/" ? path : path.split(separator).join("/"); } normalize(first); normalize(second);',
            'function readJson(value) { return read(value, "json"); } readJson(first); readJson(second);',
            'function callback(value) { return value.active; } items.filter(callback);',
            'const callback = (value) => value.active; items.filter(callback);',
            'function callback() { update(); } on(callback); off(callback);',
            'function callback(a, b) { return a; } consume(callback.length);',
        ].map((code) => ({ code, errors: [{ messageId: 'trivial' as const }] })),
        {
            code: 'function outer() { function inner() {} }',
            errors: [{ messageId: 'trivial' }, { messageId: 'trivial' }],
        },
        {
            code: 'function three() { first(); second(); third(); }',
            options: [{ maxStatements: 3 }],
            errors: [{ messageId: 'trivial' }],
        },
    ],
});
