import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { LEVELS } from '#cli/config/configurations.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { TYPESCRIPT_FILES } from '#tests/data/generation/eslint/fragments.ts';
import { TYPE_EXPORT_FILES, TYPED_RULE_PROJECTS } from '#tests/data/generation/eslint/levels.ts';
import { createEslint, listFindingRules, collectLintFindings } from '#tests/setup/tool-files.ts';

test.each([...TYPED_RULE_PROJECTS])('$name gets typed lint rules', async ({ configurations, tables, files, file }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText([...configurations], { level: 'all', tables }),
        ...files,
    });
    const eslint = await createEslint(sandbox.path);
    const rules = ['@typescript-eslint/no-unnecessary-type-assertion'];
    expect(await collectLintFindings(eslint, sandbox.path, [file], rules)).toStrictEqual([
        { file, rule: '@typescript-eslint/no-unnecessary-type-assertion', line: 4 },
    ]);
    const source = await Bun.file(join(sandbox.path, file)).text();
    await Bun.write(join(sandbox.path, file), source.replace(' as number', ''));
    expect(await collectLintFindings(eslint, sandbox.path, [file], rules)).toStrictEqual([]);
});

test.each([...LEVELS])('%s type import and export rules apply at their declared level', async (level) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...TYPE_EXPORT_FILES,
        'gspot.toml': buildSettingsText(['typescript'], {
            level,
            tables: '[structure]\nreexports = { value = "index-only", reason = "The package exports its public index files." }\n',
        }),
    });
    const eslint = await createEslint(sandbox.path);
    const rules = ['@typescript-eslint/consistent-type-imports', '@typescript-eslint/consistent-type-exports'];
    const findings = await collectLintFindings(eslint, sandbox.path, ['index.ts'], rules);
    expect(listFindingRules(findings)).toStrictEqual(
        level === 'all' ? rules.toSorted((left, right) => left.localeCompare(right)) : [],
    );
});

test('reexports = index-only keeps re-exports in index files and reports forwarding elsewhere', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...TYPESCRIPT_FILES,
        'gspot.toml': buildSettingsText(['typescript'], {
            tables: '[structure]\nreexports = { value = "index-only", reason = "The package exports its public index files." }\n',
            level: 'all',
        }),
        'src/first.ts': 'export const shared = 1;\n',
        'src/second.ts': 'export const shared = 2;\n',
        'src/index.ts': 'export * from "./first.js";\nexport { shared as second } from "./second.js";\n',
        'src/forward.ts': 'export { shared } from "./first.js";\n',
    });
    const eslint = await createEslint(sandbox.path);
    const reported = await collectLintFindings(
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
    const corrected = await collectLintFindings(
        eslint,
        sandbox.path,
        ['src'],
        ['no-restricted-syntax', 'gspot/no-trivial-files'],
    );
    expect(corrected.filter(({ rule }) => rule === 'no-restricted-syntax')).toStrictEqual([]);
});

test('a default import with an inline type merges with a type-only import into code that parses', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['typescript']),
        'package.json': '{"private":true,"type":"module"}\n',
        'tsconfig.json': '{"compilerOptions":{"strict":true,"noEmit":true},"include":["client.ts"]}\n',
        'client.ts': '',
    });
    const eslint = await createEslint(sandbox.path, { fix: ({ ruleId }) => ruleId === 'import-x/no-duplicates' });
    const source =
        "import type { Level } from 'hls.js';\nimport Hls, { Events, type Config } from 'hls.js';\nexport { Hls, Events, type Config, type Level };\n";
    const [result] = await eslint.lintText(source, { filePath: 'client.ts' });
    expect(result?.fatalErrorCount).toBe(0);
    expect(result?.output).toBeDefined();
    const [again] = await eslint.lintText(result!.output!, { filePath: 'client.ts' });
    expect(again?.fatalErrorCount).toBe(0);
});
