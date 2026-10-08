import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { createEslint } from '#tests/harness/generated.ts';
import { CALLBACK_SOURCE } from '#tests/config/cli/generation/eslint/functions.ts';

test('generated lint accepts JavaScript method node shapes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['javascript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}\n',
        'counter.js': '',
    });
    const eslint = await createEslint(sandbox.path);
    const source = 'export class Counter {\n    get value() { return 1; }\n    method() { return 1; }\n}\n';
    const findings = await eslint.lintText(source, { filePath: 'counter.js' });
    expect(
        findings
            .flatMap(({ messages }) => messages)
            .filter(({ ruleId }) => ruleId === 'gspot/no-trivial-functions')
            .map(({ line, messageId: diagnostic }) => ({ line, messageId: diagnostic })),
    ).toStrictEqual([{ line: 3, messageId: 'trivial' }]);
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

test('generated lint preserves required class method contracts', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript'], { tables: '[agent_rules]\nenabled = false\n', level: 'all' }),
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
    const eslint = await createEslint(sandbox.path);
    const results = await eslint.lintFiles(['methods.ts']);
    expect(
        results.flatMap(({ messages }) => messages).filter(({ ruleId }) => ruleId === 'gspot/no-trivial-functions'),
    ).toMatchObject([6, 7].map((line) => ({ line, messageId: 'trivial' })));
});

test('generated lint reports local wrappers and preserves exported functions and inline callbacks', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript'], { tables: '[agent_rules]\nenabled = false\n', level: 'all' }),
        'package.json': '{"private":true,"type":"module"}\n',
        'tsconfig.json': '{"compilerOptions":{"strict":true,"noEmit":true},"include":["**/*.ts"]}\n',
        'callbacks.ts': CALLBACK_SOURCE,
        'consumer.ts': [
            'import { read, invoked, typeOnly, parenthesized } from "./callbacks";',
            'import * as callbacks from "./callbacks";',
            'import { aliasedCallback as callback } from "./callbacks";',
            'export const listeners = { read, namespaceCallback: callbacks.namespaceCallback, callback };',
            'read(1); invoked(1); (parenthesized)(1);',
            'export type Signature = typeof typeOnly;',
            'import { area as size, forward } from "./callbacks";',
            'size(2, 3); callbacks.area(4, 5); forward(1); callbacks.forward(2);',
            'import { bounded } from "./callbacks";',
            'bounded(1); callbacks.bounded(2);',
        ].join('\n'),
    });
    const eslint = await createEslint(sandbox.path);
    const results = await eslint.lintFiles(['callbacks.ts']);
    // Inline callbacks and recursive functions remain valid; invoked local wrappers are reported.
    expect(
        results
            .flatMap((file) => file.messages)
            .filter(({ ruleId }) => ruleId === 'gspot/no-trivial-functions')
            .map(({ line, messageId: diagnostic }) => ({ line, messageId: diagnostic })),
    ).toStrictEqual([17, 19].map((line) => ({ line, messageId: 'trivial' })));
});

test('generated file ownership keeps constructor state and rejects small calculations and forwarding', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript'], { tables: '[agent_rules]\nenabled = false\n', level: 'all' }),
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
    const eslint = await createEslint(sandbox.path);
    const state = await eslint.lintFiles(['parameter-state.ts', 'assigned-state.ts']);
    expect(
        state
            .flatMap(({ messages }) => messages)
            .filter(({ ruleId }) => ruleId === 'gspot/no-trivial-files' || ruleId === 'gspot/no-trivial-functions'),
    ).toStrictEqual([]);
    const trivial = (name: string, results: Awaited<ReturnType<typeof eslint.lintFiles>>) =>
        results
            .flatMap(({ messages }) => messages)
            .filter(({ ruleId }) => ruleId === name)
            .map(({ line, column, messageId: diagnostic }) => ({ line, column, messageId: diagnostic }));
    // Exported APIs remain valid functions. A forwarding file still needs content of its own.
    for (const file of ['area.ts', 'render.ts', 'forward.ts']) {
        const results = await eslint.lintFiles([file]);
        expect(trivial('gspot/no-trivial-functions', results)).toStrictEqual([]);
        expect(trivial('gspot/no-trivial-files', results)).toStrictEqual([
            { line: 1, column: 1, messageId: 'trivial' },
        ]);
    }
});

test('generated all lint keeps callbacks written as object properties', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript'], { tables: '[agent_rules]\nenabled = false\n', level: 'all' }),
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
    const eslint = await createEslint(sandbox.path);
    const results = await eslint.lintFiles(['options.ts']);
    expect(
        results.flatMap(({ messages }) => messages).filter(({ ruleId }) => ruleId === 'gspot/no-trivial-functions'),
    ).toStrictEqual([]);
});
