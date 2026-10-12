import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { LEVELS } from '#cli/config/configurations.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { TYPE_EXPORT_FILES } from '#tests/config/eslint/levels.ts';
import { TYPESCRIPT_FILES } from '#tests/config/eslint/fragments.ts';
import { STRICT_COMPILER_OPTIONS } from '#tests/config/typescript.ts';
import { lintFindings, createEslint } from '#tests/setup/generate.ts';
import { DUPLICATE_RULE_CASES } from '#tests/config/eslint/lint-rules.ts';

test('the generated TypeScript configuration gives lint rules type information', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['typescript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}\n',
        'tsconfig.json': '{"compilerOptions":{"strict":true,"noEmit":true},"include":["**/*.ts"]}\n',
        'source.ts': 'export const port = Number("8080") as number;\n',
    });
    const eslint = await createEslint(sandbox.path);
    expect(
        await lintFindings(eslint, sandbox.path, ['source.ts'], ['@typescript-eslint/no-unnecessary-type-assertion']),
    ).toStrictEqual([{ file: 'source.ts', rule: '@typescript-eslint/no-unnecessary-type-assertion', line: 1 }]);
});

test.each([...LEVELS])('%s type import and export rules apply at their declared level', async (level) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...TYPE_EXPORT_FILES,
        'gspot.toml': settingsText(['typescript'], {
            level,
            tables: '[structure]\nreexports = { value = "index-only", reason = "The package exports its public index files." }\n',
        }),
    });
    const eslint = await createEslint(sandbox.path);
    const rules = ['@typescript-eslint/consistent-type-imports', '@typescript-eslint/consistent-type-exports'];
    const findings = await lintFindings(eslint, sandbox.path, ['index.ts'], rules);
    expect(
        [...new Set(findings.map(({ rule }) => rule))].toSorted((left, right) =>
            (left ?? '').localeCompare(right ?? ''),
        ),
    ).toStrictEqual(level === 'all' ? rules.toSorted((left, right) => left.localeCompare(right)) : []);
});

test('a TypeScript scope under a root without TypeScript gets typed rules', async () => {
    const source =
        '// The port the service listens on.\n\n/** The port, read once. */\nexport const port = Number("8080") as number;\n';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText([], {
            level: 'all',
            tables: '[[scope]]\npath = "api"\nconfigurations = [ "typescript" ]\n',
        }),
        'package.json': '{"name":"example","private":true,"type":"module","workspaces":["api"]}\n',
        'api/package.json': '{"name":"api","private":true,"type":"module"}\n',
        'api/tsconfig.json': JSON.stringify({ compilerOptions: STRICT_COMPILER_OPTIONS, include: ['src'] }) + '\n',
        'api/src/port.ts': source,
    });
    const eslint = await createEslint(sandbox.path);
    const files = ['api/src/port.ts'];
    const rules = ['@typescript-eslint/no-unnecessary-type-assertion'];
    expect(await lintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([
        { file: 'api/src/port.ts', rule: '@typescript-eslint/no-unnecessary-type-assertion', line: 4 },
    ]);
    await Bun.write(join(sandbox.path, 'api/src/port.ts'), source.replace(' as number', ''));
    expect(await lintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([]);
});

test('reexports = index-only keeps re-exports in index files and reports forwarding elsewhere', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...TYPESCRIPT_FILES,
        'gspot.toml': settingsText(['typescript'], {
            tables: '[structure]\nreexports = { value = "index-only", reason = "The package exports its public index files." }\n',
            level: 'all',
        }),
        'src/first.ts': 'export const shared = 1;\n',
        'src/second.ts': 'export const shared = 2;\n',
        'src/index.ts': 'export * from "./first.js";\nexport { shared as second } from "./second.js";\n',
        'src/forward.ts': 'export { shared } from "./first.js";\n',
    });
    const eslint = await createEslint(sandbox.path);
    const reported = await lintFindings(
        eslint,
        sandbox.path,
        ['src'],
        ['no-restricted-syntax', 'gspot/no-trivial-files'],
    );
    expect(reported.filter(({ rule }) => rule === 'no-restricted-syntax')).toStrictEqual([
        { rule: 'no-restricted-syntax', file: 'src/forward.ts', line: 1 },
    ]);
    expect(
        reported.filter(
            ({ file, rule }) =>
                file === 'src/index.ts' && ['gspot/no-trivial-files', 'no-restricted-syntax'].includes(rule ?? ''),
        ),
    ).toStrictEqual([]);
    await writeFile(join(sandbox.path, 'src/forward.ts'), 'export const shared = 1;\n');
    const corrected = await lintFindings(
        eslint,
        sandbox.path,
        ['src'],
        ['no-restricted-syntax', 'gspot/no-trivial-files'],
    );
    expect(corrected.filter(({ rule }) => rule === 'no-restricted-syntax')).toStrictEqual([]);
});

test('an unused local is reported once and using declarations are accepted', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['typescript']),
        'package.json': '{"private":true,"type":"module"}\n',
        'tsconfig.json':
            '{"compilerOptions":{"strict":true,"noEmit":true,"target":"ESNext"},"include":["client.ts"]}\n',
        'client.ts': 'export {};\n',
    });
    const eslint = await createEslint(sandbox.path);
    const rules = DUPLICATE_RULE_CASES.find(({ file }) => file === 'unused.ts')!.rules;
    await createFileTree(sandbox.path, {
        'client.ts': 'export function count(): number { const unused = 1; return 2; }\n',
    });
    expect(await lintFindings(eslint, sandbox.path, ['client.ts'], rules)).toStrictEqual([
        { file: 'client.ts', rule: '@typescript-eslint/no-unused-vars', line: 1 },
    ]);
    await createFileTree(sandbox.path, {
        'client.ts': `
export async function disposeResources(): Promise<void> {
    using local = { [Symbol.dispose]() {} };
    await using asynchronous = { async [Symbol.asyncDispose]() {} };
}
`,
    });
    expect(await lintFindings(eslint, sandbox.path, ['client.ts'], rules)).toStrictEqual([]);
});
