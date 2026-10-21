import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { LEVELS } from '#cli/config/configurations.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { createEslint, listFindingRules, listLintFindings } from '#tests/setup/tool-files.ts';
import { TYPE_EXPORT_FILES, TYPED_RULE_PROJECTS } from '#tests/data/generation/eslint/levels.ts';

test.each([...TYPED_RULE_PROJECTS])('$name gets typed lint rules', async ({ configurations, tables, files, file }) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([...configurations], { level: 'all', tables }),
        ...files,
    });

    const eslint = await createEslint(sandbox.path);
    const rules = ['@typescript-eslint/no-unnecessary-type-assertion'];
    expect(await listLintFindings(eslint, sandbox.path, [file], rules)).toStrictEqual([
        { file, rule: '@typescript-eslint/no-unnecessary-type-assertion', line: 4 },
    ]);
    const source = await readFile(join(sandbox.path, file), 'utf8');
    await writeFile(join(sandbox.path, file), source.replace(' as number', ''));
    expect(await listLintFindings(eslint, sandbox.path, [file], rules)).toStrictEqual([]);
});

test.each([...LEVELS])('%s type import and export rules apply at their declared level', async (level) => {
    await using sandbox = await testdir({
        ...TYPE_EXPORT_FILES,
        'gspot.toml': buildSandboxSettings(['typescript'], {
            level,
            tables: '[structure]\nreexports = { value = "index-only", reason = "The package exports its public index files." }\n',
        }),
    });

    const eslint = await createEslint(sandbox.path);
    const rules = ['@typescript-eslint/consistent-type-imports', '@typescript-eslint/consistent-type-exports'];
    const findings = await listLintFindings(eslint, sandbox.path, ['index.ts'], rules);
    expect(listFindingRules(findings)).toStrictEqual(
        level === 'all' ? rules.toSorted((left, right) => left.localeCompare(right)) : [],
    );
});

test('a default import with an inline type merges with a type-only import into code that parses', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript']),
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

test('gspot/no-magic-numbers accepts the numbers of a module-level const and reports the others', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}\n',
        'tsconfig.json': '{"compilerOptions":{"strict":true,"noEmit":true},"include":["source.ts"]}\n',
        'source.ts':
            'export const SIZES = [16, 32, 64];\nexport const TIMEOUT_MS = 60 * 1000;\nexport function wait(): number {\n    return TIMEOUT_MS + 250;\n}\n',
    });

    const eslint = await createEslint(sandbox.path);
    expect(
        await listLintFindings(
            eslint,
            sandbox.path,
            ['source.ts'],
            ['gspot/no-magic-numbers', '@typescript-eslint/no-magic-numbers'],
        ),
    ).toStrictEqual([{ file: 'source.ts', rule: 'gspot/no-magic-numbers', line: 4 }]);
});
