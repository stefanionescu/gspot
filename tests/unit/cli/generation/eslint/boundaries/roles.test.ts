import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { LEVELS } from '#cli/config/configurations.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { createEslint, lintFindings } from '#tests/setup/generate.ts';

import {
    ROLE_TARGETS,
    ROLE_TSCONFIG,
    ENVIRONMENT_CASES,
    ROLE_IMPORT_CASES,
    ENVIRONMENT_TABLES,
    TEST_IMPORT_TABLES,
    ENVIRONMENT_COMPOSED,
} from '#tests/config/eslint/architecture.ts';

test.each([...LEVELS])(
    'a file outside test_files may not import a test file, in root and child scopes, at %s',
    async (level) => {
        await using sandbox = await testdir();
        const settings = settingsText(['typescript'], { level, tables: TEST_IMPORT_TABLES });
        await createFileTree(sandbox.path, {
            'gspot.toml': settings,
            'package.json': '{"private":true,"type":"module"}',
            'tsconfig.json': ROLE_TSCONFIG,
            'app/tsconfig.json': ROLE_TSCONFIG,
            ...Object.fromEntries(
                ['', 'app/'].flatMap((prefix) =>
                    Object.entries(ROLE_TARGETS).map(([path, source]) => [prefix + path, source]),
                ),
            ),
        });
        const files = ['', 'app/'].flatMap((prefix) =>
            ROLE_IMPORT_CASES.map((row, index) => ({
                ...row,
                path: `${prefix}${row.folder}/case${String(index)}.ts`,
            })),
        );
        for (const row of files) await Bun.write(join(sandbox.path, row.path), row.source);
        const eslint = await createEslint(sandbox.path);
        for (const row of files) {
            expect(await lintFindings(eslint, sandbox.path, [row.path], ['boundaries/dependencies'])).toStrictEqual(
                level === 'all' && row.rejected ? [{ file: row.path, rule: 'boundaries/dependencies', line: 1 }] : [],
            );
        }
    },
);

test.each([...LEVELS])(
    'environment reads are allowed only in environment_readers files of each scope at %s',
    async (level) => {
        await using sandbox = await testdir();
        const settings = settingsText(['typescript'], { level, tables: ENVIRONMENT_TABLES });
        const paths = [
            'src/source.js',
            'config/env.js',
            'app/src/source.js',
            'app/src/env/source.js',
            'sibling/src/source.js',
            'app/deep/src/source.js',
            'literal/src/source.js',
            'literal/config/env.js',
        ];
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
                expect(await lintFindings(eslint, sandbox.path, [path], [rule])).toStrictEqual(
                    rejected ? [{ file: path, rule, line: 1 }] : [],
                );
            }
            await createFileTree(sandbox.path, { [path]: 'const port = "3000";\n' });
            expect(
                await lintFindings(
                    eslint,
                    sandbox.path,
                    [path],
                    ENVIRONMENT_CASES.map(({ rule }) => rule),
                ),
            ).toStrictEqual([]);
        }
        await createFileTree(sandbox.path, { 'app/src/source.js': ENVIRONMENT_COMPOSED });
        expect(await lintFindings(eslint, sandbox.path, ['app/src/source.js'], ['no-restricted-syntax'])).toStrictEqual(
            level === 'all'
                ? [
                      { file: 'app/src/source.js', rule: 'no-restricted-syntax', line: 1 },
                      { file: 'app/src/source.js', rule: 'no-restricted-syntax', line: 2 },
                  ]
                : [],
        );
    },
);

test('environment rules stay off when no env role is set, at all', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['typescript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}',
        'src/source.js': '',
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src/**/*.ts"]}',
    });
    const eslint = await createEslint(sandbox.path);
    for (const { source, rule } of ENVIRONMENT_CASES) {
        await createFileTree(sandbox.path, { 'src/source.js': source });
        expect(await lintFindings(eslint, sandbox.path, ['src/source.js'], [rule])).toStrictEqual([]);
    }
});
