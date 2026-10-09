import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { createEslint } from '#tests/harness/generated.ts';
import { CALLBACK_SOURCE } from '#tests/config/cli/generation/eslint/functions.ts';

test('generated lint preserves required class method contracts', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript'], { level: 'all' }),
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
        'gspot.toml': buildPolicy(['typescript'], { level: 'all' }),
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
