import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { createEslint } from '#tests/harness/generated.ts';

test.each(['recommended', 'all'])(
    'generated %s ESLint permits JavaScript type documentation and rejects duplicate TypeScript type tags',
    async (level) => {
        await using sandbox = await testdir();
        const description =
            '/**\n * Measure the input.\n * @param {string} value The input text.\n * @returns {number} The input length.\n */\n';
        const typescript = 'export function measure(value: string): number { return value.length; }\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['typescript'], { tables: '[agent_rules]\nenabled = false\n', level: level }),
            'package.json': '{"private":true,"type":"module"}\n',
            'tsconfig.json': '{"compilerOptions":{"strict":true,"noEmit":true},"include":["client.ts"]}\n',
            'client.ts': description + typescript,
            'client.js': description + 'export function measure(value) { return value.length; }\n',
        });
        const eslint = await createEslint(sandbox.path);
        const javascript = await eslint.lintFiles(['client.js']);
        expect(
            javascript
                .flatMap((file) => file.messages)
                .filter(({ ruleId, fatal }) => ruleId === 'jsdoc/no-types' || fatal),
        ).toStrictEqual([]);
        const testRepository = await eslint.lintFiles(['client.ts']);
        expect(
            testRepository
                .flatMap((file) => file.messages)
                .filter(({ ruleId }) => ruleId === 'jsdoc/no-types')
                .map(({ line }) => ({ line })),
        ).toStrictEqual(level === 'all' ? [{ line: 3 }, { line: 4 }] : []);
    },
);

test('generated TypeScript reports an unused ordinary local once and accepts disposal-only bindings', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript']),
        'package.json': '{"private":true,"type":"module"}\n',
        'tsconfig.json':
            '{"compilerOptions":{"strict":true,"noEmit":true,"target":"ESNext"},"include":["client.ts"]}\n',
        'client.ts': 'export {};\n',
    });
    const eslint = await createEslint(sandbox.path);
    const unused = await eslint.lintText('export function count(): number { const unused = 1; return 2; }\n', {
        filePath: 'client.ts',
    });
    expect(
        unused.flatMap((file) => file.messages).filter(({ ruleId }) => ruleId?.includes('unused') === true),
    ).toMatchObject([{ ruleId: '@typescript-eslint/no-unused-vars', line: 1 }]);
    const resources = await eslint.lintText(
        `
export async function disposeResources(): Promise<void> {
    using local = { [Symbol.dispose]() {} };
    await using asynchronous = { async [Symbol.asyncDispose]() {} };
}
`,
        { filePath: 'client.ts' },
    );
    expect(
        resources
            .flatMap((file) => file.messages)
            .filter(({ ruleId, fatal }) => fatal === true || ruleId?.includes('unused') === true),
    ).toStrictEqual([]);
});
