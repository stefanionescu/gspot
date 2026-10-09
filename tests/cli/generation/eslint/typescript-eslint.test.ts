// The TypeScript rules the generated ESLint configuration enables, loaded directly.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { PROJECT } from '#tests/config/cli/generation/eslint/typescript-eslint.ts';
import { createEslint, eslintConfigurationSchema } from '#tests/harness/generated.ts';
import type { FileRuleFinding } from '#tests/types/cli/generation/eslint/findings.ts';

// The rule, file, and place of each message ESLint reports for the source folder.
async function messagesOf(root: string): Promise<FileRuleFinding[]> {
    const eslint = await createEslint(root);
    const results = await eslint.lintFiles(['src']);
    return results.flatMap(({ filePath, messages }) =>
        messages.map(({ ruleId, line }) => ({
            rule: ruleId,
            file: filePath.slice(root.length + 1).replaceAll('\\', '/'),
            line,
        })),
    );
}

test('an interface is reported once by consistent-type-definitions and not by types-placement', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...PROJECT,
        'gspot.toml': buildPolicy(['typescript'], { level: 'all' }),
        'src/order.ts': 'export interface Order { total: number }\n',
    });
    const reported = await messagesOf(sandbox.path);
    expect(reported.filter(({ rule }) => rule === '@typescript-eslint/consistent-type-definitions')).toStrictEqual([
        { rule: '@typescript-eslint/consistent-type-definitions', file: 'src/order.ts', line: 1 },
    ]);
    expect(reported.filter(({ rule }) => rule === 'gspot/types-placement')).toStrictEqual([]);
});

test('index-only reexports keep a nonduplicate barrel and reject forwarding from an ordinary module', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...PROJECT,
        'gspot.toml': buildPolicy(['typescript'], {
            tables: '[structure]\nreexports = "index-only"\n',
            level: 'all',
        }),
        'src/first.ts': 'export const shared = 1;\n',
        'src/second.ts': 'export const shared = 2;\n',
        'src/index.ts': 'export * from "./first.js";\nexport { shared as second } from "./second.js";\n',
        'src/forward.ts': 'export { shared } from "./first.js";\n',
    });
    const reported = await messagesOf(sandbox.path);
    expect(reported.filter(({ rule }) => rule === 'no-restricted-syntax')).toStrictEqual([
        { rule: 'no-restricted-syntax', file: 'src/forward.ts', line: 1 },
        { rule: 'no-restricted-syntax', file: 'src/forward.ts', line: 1 },
    ]);
    expect(
        reported.filter(
            ({ file, rule }) =>
                file === 'src/index.ts' && ['gspot/no-trivial-files', 'no-restricted-syntax'].includes(rule ?? ''),
        ),
    ).toStrictEqual([]);
    await writeFile(join(sandbox.path, 'src/forward.ts'), 'export const shared = 1;\n');
    const corrected = await messagesOf(sandbox.path);
    expect(corrected.filter(({ rule }) => rule === 'no-restricted-syntax')).toStrictEqual([]);
});

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

test.each(['recommended', 'all'] as const)(
    'generated TypeScript enables native export validation at %s',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...PROJECT,
            'gspot.toml': buildPolicy(['typescript'], { level }),
            'src/entry.ts': 'export const total = 1;\n',
        });
        const eslint = await createEslint(sandbox.path);
        const configuration = eslintConfigurationSchema.parse(await eslint.calculateConfigForFile('src/entry.ts'));
        expect(configuration.rules['import-x/export']?.[0]).toBe(2);
    },
);
