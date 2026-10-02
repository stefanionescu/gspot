// The TypeScript rules the generated ESLint configuration enables, loaded directly.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { generatedEslint } from '#tests/harness/cli/generated.ts';

const PROJECT = {
    'package.json': '{"name":"typescript-rules","private":true,"type":"module"}',
    'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src/**/*.ts"]}',
};

// The rule, file, and place of each message ESLint reports for the source folder.
async function messagesOf(root: string): Promise<{ rule: string | null; file: string; line: number }[]> {
    const eslint = await generatedEslint(root);
    const results = await eslint.lintFiles(['src']);
    return results.flatMap(({ filePath, messages }) =>
        messages.map(({ ruleId, line }) => ({
            rule: ruleId,
            file: filePath.slice(root.length + 1).replaceAll('\\', '/'),
            line,
        })),
    );
}

test('generated TypeScript configuration reports an interface once through the pinned replacement rule', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...PROJECT,
        'gspot.toml': policyOf(['typescript'], '[guides]\ninstall = false\n', 'all'),
        'src/order.ts': 'export interface Order { total: number }\n',
    });
    const reported = await messagesOf(sandbox.path);
    expect(
        reported.filter(
            ({ rule }) => rule === '@typescript-eslint/consistent-type-definitions' || rule === 'gspot/types-placement',
        ),
    ).toStrictEqual([{ rule: '@typescript-eslint/consistent-type-definitions', file: 'src/order.ts', line: 1 }]);
    writeFileSync(
        join(sandbox.path, 'src/order.ts'),
        '// The shape of a priced order.\n\n/** A total owned by one order. */\nexport type Order = { total: number };\n',
    );
    expect(await messagesOf(sandbox.path)).toStrictEqual([]);
});

test.each([
    ['star exports', 'export * from "./first.js";\nexport * from "./second.js";\n'],
    ['a local declaration', 'export { shared } from "./first.js";\nexport const shared = 3;\n'],
    ['nested star exports', 'export * from "./bridge/index.js";\nexport { shared } from "./first.js";\n'],
])('generated index-only policy reports duplicate names from %s', async (_scenario, barrel) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...PROJECT,
        'gspot.toml': policyOf(
            ['typescript'],
            '[guides]\ninstall = false\n[structure]\nreexports = "index-only"\n',
            'all',
        ),
        'src/first.ts': 'export const shared = 1;\n',
        'src/second.ts': 'export const shared = 2;\n',
        'src/index.ts': barrel,
        'src/bridge/index.ts': 'export * from "../first.js";\n',
        'src/forward.ts': 'export { shared } from "./first.ts";\n',
    });
    const reported = await messagesOf(sandbox.path);
    expect(reported.filter(({ rule }) => rule === 'gspot/no-reexports')).toStrictEqual([
        { rule: 'gspot/no-reexports', file: 'src/forward.ts', line: 1 },
    ]);
    expect(reported.filter(({ rule }) => rule === 'import-x/export')).toStrictEqual([
        { rule: 'import-x/export', file: 'src/index.ts', line: 1 },
        { rule: 'import-x/export', file: 'src/index.ts', line: 2 },
    ]);
    writeFileSync(
        join(sandbox.path, 'src/index.ts'),
        'export * from "./first.js";\nexport { shared as second } from "./second.js";\n',
    );
    writeFileSync(join(sandbox.path, 'src/forward.ts'), 'export const shared = 1;\n');
    const corrected = await messagesOf(sandbox.path);
    expect(corrected).toContainEqual({ rule: 'gspot/no-trivial-files', file: 'src/index.ts', line: 1 });
    expect(corrected.filter(({ rule }) => rule === 'gspot/no-reexports' || rule === 'import-x/export')).toStrictEqual(
        [],
    );
});
