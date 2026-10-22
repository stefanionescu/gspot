import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { LEVELS } from '#cli/config/configurations.ts';
import { unlink, readFile, writeFile } from 'node:fs/promises';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import type { EslintConfiguration } from '#tests/types/tool-output.ts';
import { parseToolPackageJson } from '#cli/install/npm/tool-project.ts';
import { createEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';
import { assertPackageManager } from '#cli/repository/npm/package-manager.ts';

import {
    CAN_IMPORT_TABLES,
    ENVIRONMENT_CASES,
    IMPORT_RULE_CASES,
    IMPORT_RULE_FILES,
    TEST_IMPORT_CASES,
    TEST_IMPORT_PATHS,
    ENVIRONMENT_TABLES,
    IMPORT_RULE_TABLES,
    TEST_IMPORT_TABLES,
    ENVIRONMENT_COMPOSED,
    TEST_IMPORT_TSCONFIG,
    TEST_IMPORT_RULE_CASES,
    REFUSED_IMPORT_MESSAGES,
    TEST_IMPORT_RULE_TABLES,
    ENVIRONMENT_READER_PATHS,
    IMPORT_RULE_CORRECTED_SOURCE,
} from '#tests/data/generation/eslint/boundaries.ts';

test.each([...IMPORT_RULE_CASES])(
    '$level loads eslint-plugin-boundaries for $declarations import rules',
    async ({ level, declarations }) => {
        await using sandbox = await testdir();
        const settings = buildSandboxSettings(['typescript'], { level, tables: IMPORT_RULE_TABLES[declarations] });
        await createFileTree(sandbox.path, { ...IMPORT_RULE_FILES, 'gspot.toml': settings });
        const eslint = await createEslint(sandbox.path);
        const session = await openSession(sandbox.path);
        const packages = parseToolPackageJson(
            await readFile(join(sandbox.path, '.gspot/package.json'), 'utf8'),
            assertPackageManager(session.packageManager).name,
        );
        const enabled = level === 'all' || declarations !== 'none';
        expect(Object.hasOwn(packages.dependencies, 'eslint-plugin-boundaries')).toBe(enabled);
        expect(Object.hasOwn(packages.dependencies, 'eslint-import-resolver-typescript')).toBe(true);
        if (!enabled) await unlink(join(sandbox.path, 'node_modules/eslint-plugin-boundaries'));
        async function lintFiles() {
            const files = ['app/source.ts', 'apps/api/app/source.ts'];
            const configured = [];
            for (const file of files) {
                const config = (await eslint.calculateConfigForFile(file)) as EslintConfiguration;
                configured.push({
                    plugin: Object.hasOwn(config.plugins, 'boundaries'),
                    classic: Object.hasOwn(config.settings, 'import/resolver'),
                    modern: Object.hasOwn(config.settings, 'import-x/resolver-next'),
                });
            }
            return {
                configured,
                findings: await listLintFindings(eslint, sandbox.path, files, ['boundaries/dependencies']),
            };
        }
        const configured = [
            { plugin: enabled, classic: enabled, modern: true },
            { plugin: enabled, classic: enabled, modern: true },
        ];
        expect(await lintFiles()).toStrictEqual({
            configured,
            findings:
                declarations === 'none'
                    ? []
                    : [
                          {
                              file: declarations === 'root' ? 'app/source.ts' : 'apps/api/app/source.ts',
                              rule: 'boundaries/dependencies',
                              line: 1,
                          },
                      ],
        });
        await Promise.all(
            ['app/source.ts', 'apps/api/app/source.ts'].map((file) =>
                writeFile(join(sandbox.path, file), IMPORT_RULE_CORRECTED_SOURCE),
            ),
        );
        expect(await lintFiles()).toStrictEqual({ configured, findings: [] });
    },
);

test('import rules skip your test files in each scope and check other files', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all', tables: TEST_IMPORT_RULE_TABLES }),
        'package.json': '{"name":"boundaries","private":true,"type":"module"}',
        'storage/value.js': 'export const value = 1;\n',
        'apps/api/storage/value.js': 'export const value = 1;\n',
        ...Object.fromEntries(
            TEST_IMPORT_RULE_CASES.map(({ path, importPath }) => [
                path,
                `import { value } from '${importPath}';\nconsole.log(value);\n`,
            ]),
        ),
    });

    const eslint = await createEslint(sandbox.path);
    expect(
        await listLintFindings(
            eslint,
            sandbox.path,
            TEST_IMPORT_RULE_CASES.map(({ path }) => path),
            ['boundaries/dependencies'],
        ),
    ).toStrictEqual(
        TEST_IMPORT_RULE_CASES.flatMap(({ path, count }) =>
            Array.from({ length: count }, () => ({ file: path, rule: 'boundaries/dependencies', line: 1 })),
        ).toSorted((left, right) => left.file.localeCompare(right.file)),
    );
});

test.each([...LEVELS])(
    'a file outside test_files may not import a test file, in root and child scopes, at %s',
    async (level) => {
        await using sandbox = await testdir();
        const settings = buildSandboxSettings(['typescript'], { level, tables: TEST_IMPORT_TABLES });
        await createFileTree(sandbox.path, {
            'gspot.toml': settings,
            'package.json': '{"private":true,"type":"module"}',
            'tsconfig.json': TEST_IMPORT_TSCONFIG,
            'app/tsconfig.json': TEST_IMPORT_TSCONFIG,
            ...Object.fromEntries(
                ['', 'app/'].flatMap((prefix) =>
                    Object.entries(TEST_IMPORT_PATHS).map(([path, source]) => [prefix + path, source]),
                ),
            ),
        });
        const files = ['', 'app/'].flatMap((prefix) =>
            TEST_IMPORT_CASES.map((row, index) => ({
                ...row,
                path: `${prefix}${row.folder}/case${String(index)}.ts`,
            })),
        );
        for (const row of files) await writeFile(join(sandbox.path, row.path), row.source);
        const eslint = await createEslint(sandbox.path);
        for (const row of files) {
            expect(await listLintFindings(eslint, sandbox.path, [row.path], ['boundaries/dependencies'])).toStrictEqual(
                level === 'all' && row.rejected ? [{ file: row.path, rule: 'boundaries/dependencies', line: 1 }] : [],
            );
        }
    },
);

test.each([...LEVELS])(
    'environment reads are allowed only in environment_readers files of each scope at %s',
    async (level) => {
        await using sandbox = await testdir();
        const settings = buildSandboxSettings(['typescript'], { level, tables: ENVIRONMENT_TABLES });
        const paths = [...ENVIRONMENT_READER_PATHS];
        await createFileTree(sandbox.path, {
            'gspot.toml': settings,
            'package.json': '{"private":true,"type":"module"}',
            ...Object.fromEntries(paths.map((path) => [path, ''])),
            ...Object.fromEntries(
                ['', 'app/', 'sibling/', 'app/deep/', 'literal/'].map((prefix) => [
                    `${prefix}tsconfig.json`,
                    '{"compilerOptions":{"strict":true},"include":["src/**/*.ts"]}',
                ]),
            ),
        });
        const eslint = await createEslint(sandbox.path);
        for (const path of paths) {
            const rejected =
                level === 'all' && !['config/env.js', 'app/src/env/source.js', 'literal/config/env.js'].includes(path);
            for (const { source, rule } of ENVIRONMENT_CASES) {
                await createFileTree(sandbox.path, { [path]: source });
                expect(await listLintFindings(eslint, sandbox.path, [path], [rule])).toStrictEqual(
                    rejected ? [{ file: path, rule, line: 1 }] : [],
                );
            }
            await createFileTree(sandbox.path, { [path]: 'const port = "3000";\n' });
            expect(
                await listLintFindings(
                    eslint,
                    sandbox.path,
                    [path],
                    ENVIRONMENT_CASES.map(({ rule }) => rule),
                ),
            ).toStrictEqual([]);
        }
        await createFileTree(sandbox.path, { 'app/src/source.js': ENVIRONMENT_COMPOSED });
        expect(
            await listLintFindings(eslint, sandbox.path, ['app/src/source.js'], ['no-restricted-syntax']),
        ).toStrictEqual(
            level === 'all'
                ? [
                      { file: 'app/src/source.js', rule: 'no-restricted-syntax', line: 1 },
                      { file: 'app/src/source.js', rule: 'no-restricted-syntax', line: 2 },
                  ]
                : [],
        );
    },
);

test('without environment_readers, environment reads are allowed at level all', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}',
        'src/source.js': '',
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src/**/*.ts"]}',
    });

    const eslint = await createEslint(sandbox.path);
    for (const { source, rule } of ENVIRONMENT_CASES) {
        await createFileTree(sandbox.path, { 'src/source.js': source });
        expect(await listLintFindings(eslint, sandbox.path, ['src/source.js'], [rule])).toStrictEqual([]);
    }
});

test('can_import names exactly the rules a rule may import, and a refused import says what it may import', async () => {
    await using sandbox = await testdir({
        ...IMPORT_RULE_FILES,
        'gspot.toml': buildSandboxSettings(['typescript'], { tables: CAN_IMPORT_TABLES }),
        'core/value.ts': 'export const value = 3;\n',
        'app/source.ts':
            "import { value } from '../storage/value.js';\nimport { value as core } from '../core/value.js';\nexport const result = value + core;\n",
    });

    const eslint = await createEslint(sandbox.path);
    const [result] = await eslint.lintFiles(['app/source.ts']);
    expect(
        result?.messages
            .filter(({ ruleId }) => ruleId === 'boundaries/dependencies')
            .map(({ line, message }) => ({ line, message })),
    ).toStrictEqual([...REFUSED_IMPORT_MESSAGES]);
});
