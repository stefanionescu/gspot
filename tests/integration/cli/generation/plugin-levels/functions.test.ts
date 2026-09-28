import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { generatedEslint } from '#tests/support/cli/generated/eslint.ts';

const CALLBACK_SOURCE = [
    'type Callback = (value: number) => number;',
    'export const callback: Callback = (value) => value;',
    'export function wrapper(value: number) { return value; }',
    'const values = [1, 2].map((value) => value + 1);',
    'export const total = values.reduce((sum, value) => sum + value, 0);',
    'export const hooks: { stop(): void } = { stop() { release(); } };',
    'declare function release(): void;',
    'export const listeners: Record<string, () => void> = { event() { release(); } };',
    'export const optional: { fix?: (() => void) | null } = { fix: () => release() };',
    'export const quoted: { "on-ready"(): void } = { "on-ready"() { release(); } };',
    'export function observed(value: number) { return value; }',
    'export function invoked(value: number) { return value; }',
    'export function typeOnly(value: number) { return value; }',
    'export function parenthesized(value: number) { return value; }',
    'export function namespaceCallback(value: number) { return value; }',
    'export const aliasedCallback = (value: number) => value;',
    'function local() { return 1; } (local as () => number)();',
    'export const asserted = [1].map(((value) => value) as Callback);',
    'function generic<T>(value: T) { return value; } (generic<number>)(1);',
    'export const message: string | Callback = (value) => value;',
    'declare function configure(options: { error: string | ((issue: string) => string) }): void;',
    'configure({ error: (issue) => issue });',
    'export function count(n: number): number { return n === 0 ? 0 : count(n - 1); }',
    'export const recurse = function step(n: number): number { return n === 0 ? 0 : step(n - 1); };',
    'export const again = (n: number): number => n === 0 ? 0 : again(n - 1);',
    'export function area(width: number, height: number) { return width * height; }',
    'export function forward(value: number) { return Math.abs(value); }',
    'export const checks = [(value: number) => value > 0]; checks.some(check => check(1));',
    'const minimum = 1;',
    'export function bounded(value: number) { return Math.max(minimum, value); }',
].join('\n');

test.each(['recommended', 'all'])('generated %s lint accepts JavaScript method node shapes', async (level) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `version = 1\nlevel = "${level}"\nconfigurations = ["javascript"]\n`,
        'package.json': '{"private":true,"type":"module"}\n',
        'counter.js': '',
    });
    const eslint = await generatedEslint(sandbox.path);
    const source = 'export class Counter {\n    get value() { return 1; }\n    method() { return 1; }\n}\n';
    const defect = await eslint.lintText(source, { filePath: 'counter.js' });
    expect(
        defect
            .flatMap(({ messages }) => messages)
            .filter(({ ruleId }) => ruleId === 'gspot/no-trivial-functions')
            .map(({ line, messageId: diagnostic }) => ({ line, messageId: diagnostic })),
    ).toStrictEqual(level === 'all' ? [{ line: 3, messageId: 'trivial' }] : []);
    const corrected = await eslint.lintText(
        source.replace(
            'method() { return 1; }',
            'method(value) { if (value < 0) throw new RangeError("Negative input"); return Math.sqrt(value); }',
        ),
        { filePath: 'counter.js' },
    );
    expect(
        corrected.flatMap(({ messages }) => messages).filter(({ ruleId }) => ruleId === 'gspot/no-trivial-functions'),
    ).toStrictEqual([]);
});

test.each(['recommended', 'all'])('generated %s lint preserves required class method contracts', async (level) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `version = 1\nlevel = "${level}"\nconfigurations = ["typescript"]\n[rules]\ninstall = false\n`,
        'package.json': '{"private":true,"type":"module"}\n',
        'tsconfig.json': '{"compilerOptions":{"strict":true,"noEmit":true},"include":["**/*.ts"]}\n',
        'methods.ts': [
            'interface Runner { run(value: number): number; }',
            'declare class Base { inherited(): number; }',
            'export class Task extends Base implements Runner {',
            '    run(value: number): number { return value; }',
            '    inherited(): number { return 1; }',
            '    unnecessary(): number { return 1; }',
            '    static run(value: number): number { return value; }',
            '}',
        ].join('\n'),
    });
    const eslint = await generatedEslint(sandbox.path);
    const results = await eslint.lintFiles(['methods.ts']);
    expect(
        results.flatMap(({ messages }) => messages).filter(({ ruleId }) => ruleId === 'gspot/no-trivial-functions'),
    ).toMatchObject(level === 'all' ? [6, 7].map((line) => ({ line, messageId: 'trivial' })) : []);
});

test.each(['recommended', 'all'])('generated %s lint preserves required callback signatures', async (level) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `version = 1\nlevel = "${level}"\nconfigurations = ["typescript"]\n[rules]\ninstall = false\n`,
        'package.json': '{"private":true,"type":"module"}\n',
        'tsconfig.json': '{"compilerOptions":{"strict":true,"noEmit":true},"include":["**/*.ts"]}\n',
        'callbacks.ts': CALLBACK_SOURCE,
        'consumer.ts': [
            'import { observed, invoked, typeOnly, parenthesized } from "./callbacks";',
            'import * as callbacks from "./callbacks";',
            'import { aliasedCallback as callback } from "./callbacks";',
            'export const listeners = { observed, namespaceCallback: callbacks.namespaceCallback, callback };',
            'observed(1); invoked(1); (parenthesized)(1);',
            'export type Signature = typeof typeOnly;',
            'import { area as size, forward } from "./callbacks";',
            'size(2, 3); callbacks.area(4, 5); forward(1); callbacks.forward(2);',
            'import { bounded } from "./callbacks";',
            'bounded(1); callbacks.bounded(2);',
        ].join('\n'),
    });
    const eslint = await generatedEslint(sandbox.path);
    const results = await eslint.lintFiles(['callbacks.ts']);
    expect(
        results.flatMap((file) => file.messages).filter(({ ruleId }) => ruleId === 'gspot/no-trivial-functions'),
    ).toMatchObject(
        level === 'all'
            ? [
                  ...[3, 12, 13, 14].map((line) => ({ line, column: 8, messageId: 'trivial' })),
                  { line: 17, column: 1, messageId: 'trivial' },
                  { line: 19, column: 1, messageId: 'trivial' },
                  { line: 27, column: 8, messageId: 'trivial' },
              ]
            : [],
    );
});

test.each(['recommended', 'all'])(
    'generated %s file ownership preserves shared calculations and rejects forwarding',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': `version = 1\nlevel = "${level}"\nconfigurations = ["typescript"]\n[rules]\ninstall = false\n`,
            'package.json': '{"private":true,"type":"module"}\n',
            'tsconfig.json': '{"compilerOptions":{"strict":true,"noEmit":true},"include":["**/*.ts"]}\n',
            'area.ts': 'export function area(width: number, height: number) { return width * height; }\n',
            'render.ts':
                'export function render(template: string, file: string) { return template.replaceAll("{{file}}", () => file); }\n',
            'parameter-state.ts': 'export class Settings { constructor(public enabled: boolean) {} }\n',
            'assigned-state.ts':
                'export class Failure extends Error { constructor(message: string) { super(message); this.name = "Failure"; } }\n',
            'forward.ts': 'export function forward(value: number) { return Math.abs(value); }\n',
            'consumer.ts':
                'import { area } from "./area"; import { forward } from "./forward"; import { render } from "./render"; area(2, 3); area(4, 5); forward(1); forward(2); render("{{file}}", "one"); render("{{file}}", "two");\n',
        });
        const eslint = await generatedEslint(sandbox.path);
        const area = await eslint.lintFiles(['area.ts', 'render.ts', 'parameter-state.ts', 'assigned-state.ts']);
        expect(
            area
                .flatMap(({ messages }) => messages)
                .filter(({ ruleId }) => ruleId === 'gspot/no-trivial-files' || ruleId === 'gspot/no-trivial-functions'),
        ).toStrictEqual([]);
        const forward = await eslint.lintFiles(['forward.ts']);
        expect(
            forward
                .flatMap(({ messages }) => messages)
                .filter(({ ruleId }) => ruleId === 'gspot/no-trivial-functions')
                .map(({ line, column, messageId: diagnostic }) => ({ line, column, messageId: diagnostic })),
        ).toStrictEqual(level === 'all' ? [{ line: 1, column: 8, messageId: 'trivial' }] : []);
        expect(
            forward
                .flatMap(({ messages }) => messages)
                .filter(({ ruleId }) => ruleId === 'gspot/no-trivial-files')
                .map(({ line, column, messageId: diagnostic }) => ({ line, column, messageId: diagnostic })),
        ).toStrictEqual(level === 'all' ? [{ line: 1, column: 1, messageId: 'trivial' }] : []);
    },
);

test.each(['recommended', 'all'])(
    'generated %s lint preserves callbacks carried through option spreads',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': `version = 1\nlevel = "${level}"\nconfigurations = ["typescript"]\n[rules]\ninstall = false\n`,
            'package.json': '{"private":true,"type":"module"}\n',
            'tsconfig.json': '{"compilerOptions":{"strict":true,"noEmit":true},"include":["**/*.ts"]}\n',
            'options.ts': [
                'declare function consume(options: { onValue(value: number): void }): void;',
                'declare function write(value: number): void;',
                'const options = { onValue: (value: number) => write(value) };',
                'const copied = { ...options };',
                'consume({ ...copied });',
                'options.onValue(1);',
                'const local = { onValue: (value: number) => write(value) };',
                'local.onValue(1);',
            ].join('\n'),
        });
        const eslint = await generatedEslint(sandbox.path);
        const results = await eslint.lintFiles(['options.ts']);
        expect(
            results.flatMap(({ messages }) => messages).filter(({ ruleId }) => ruleId === 'gspot/no-trivial-functions'),
        ).toMatchObject(level === 'all' ? [{ line: 7, column: 26, messageId: 'trivial' }] : []);
    },
);
