import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { LEVELS } from '#cli/config/configurations/names.ts';
import { unlink, readFile, writeFile } from 'node:fs/promises';
import { type EslintConfiguration } from '#tests/types/tools.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { parseToolPackageJson } from '#cli/install/npm/package-json.ts';
import { createEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';

import {
    ENVIRONMENT_CASES,
    IMPORT_RULE_CASES,
    IMPORT_RULE_FILES,
    TEST_IMPORT_CASES,
    ENVIRONMENT_TABLES,
    IMPORT_RULE_TABLES,
    BOUNDARY_IMPORT_TABLES,
    TEST_IMPORT_RULE_CASES,
    REFUSED_IMPORT_MESSAGES,
    TEST_IMPORT_RULE_TABLES,
    ENVIRONMENT_READER_PATHS,
} from '#tests/config/generation/configurations/language/javascript/eslint/blocks/boundaries.ts';

test.each([...IMPORT_RULE_CASES])(
    '$level loads eslint-plugin-boundaries for $declarations import rules',
    async ({ level, declarations }) => {
        const IMPORT_RULE_CORRECTED_SOURCE = "import { value } from './value.js';\nexport const result = value;\n";

        await using sandbox = await testdir();
        const settings = buildSandboxSettings(['typescript'], { level, tables: IMPORT_RULE_TABLES[declarations] });
        await createFileTree(sandbox.path, { ...IMPORT_RULE_FILES, 'gspot.toml': settings });
        const eslint = await createEslint(sandbox.path);
        const session = await openSession(sandbox.path);
        const packages = parseToolPackageJson(
            await readFile(join(sandbox.path, GSPOT_PATHS.npmProject), 'utf8'),
            session.packageManager!.name,
        );
        const isEnabled = level === 'all' || declarations !== 'none';
        expect(Object.hasOwn(packages.dependencies, 'eslint-plugin-boundaries')).toBe(isEnabled);
        expect(Object.hasOwn(packages.dependencies, 'eslint-import-resolver-typescript')).toBe(true);
        if (!isEnabled) await unlink(join(sandbox.path, 'node_modules/eslint-plugin-boundaries'));
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
            { plugin: isEnabled, classic: isEnabled, modern: true },
            { plugin: isEnabled, classic: isEnabled, modern: true },
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
        const TEST_IMPORT_PATHS = {
            'src/value.ts': 'export const value = 1;\nexport type Value = number;\n',
            'tests/value.ts': 'export const value = 1;\nexport type Value = number;\n',
            'other/value.test.ts': 'export const value = 1;\n',
        } as const;

        const TEST_IMPORT_TSCONFIG =
            '{"compilerOptions":{"strict":true,"noEmit":true,"target":"ES2022","module":"NodeNext","moduleResolution":"NodeNext","baseUrl":".","paths":{"@/*":["./*"]},"types":[]},"include":["**/*.ts"]}';

        const TEST_IMPORT_TABLES = `[[scope]]
path = "app"
configurations = ["typescript"]
`;

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
        const ENVIRONMENT_COMPOSED = "export * from './other.js';\nconst port = import.meta.env.PORT;\n";

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
            const isRejected =
                level === 'all' && !['config/env.js', 'app/src/env/source.js', 'literal/config/env.js'].includes(path);
            for (const { source, rule } of ENVIRONMENT_CASES) {
                await createFileTree(sandbox.path, { [path]: source });
                expect(await listLintFindings(eslint, sandbox.path, [path], [rule])).toStrictEqual(
                    isRejected ? [{ file: path, rule, line: 1 }] : [],
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
        'gspot.toml': buildSandboxSettings(['typescript'], { tables: BOUNDARY_IMPORT_TABLES }),
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
