import { readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { compareText } from '#cli/system/text.ts';
import {
    COMPONENT_IMPORT_CASES,
    ENVIRONMENT_CASES,
    ENVIRONMENT_READER_PATHS,
    ENVIRONMENT_TABLES,
    IMPORT_RULE_CASES,
    IMPORT_RULE_FILES,
    IMPORT_RULE_TABLES,
    TEST_IMPORT_CASES,
    TEST_IMPORT_RULE_CASES,
    TEST_IMPORT_RULE_TABLES,
    TEST_IMPORT_TSCONFIG,
} from '#tests/config/configurations/javascript/blocks.ts';
import { APP_SCOPE_SETTINGS } from '#tests/config/setup/languages.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';
import type { ToolPackageJson } from '#tests/types/setup.ts';

test.each(COMPONENT_IMPORT_CASES)(
    '$configuration component imports obey their import rule',
    async ({ configuration, file, opening, closing }) => {
        const path = `app/${file}`;
        await using sandbox = await testdir({
            ...IMPORT_RULE_FILES,
            'tsconfig.json': '{"compilerOptions":{"strict":true,"types":[]},"include":["**/*"]}',
            'gspot.toml': buildSandboxSettings(['typescript', configuration], { tables: IMPORT_RULE_TABLES.root }),
            [path]: `${opening}\nimport { value } from '../storage/value.js';\nconst result = value;\n${closing}\n`,
        });
        const eslint = await buildEslint(sandbox.path);
        expect(await listLintFindings(eslint, sandbox.path, [path], ['boundaries/dependencies'])).toStrictEqual([
            { file: path, rule: 'boundaries/dependencies', line: 2 },
        ]);
    },
);

test.each([...IMPORT_RULE_CASES])(
    '$level loads eslint-plugin-boundaries for $declarations import rules',
    async ({ level, declarations }) => {
        await using sandbox = await testdir();
        const settings = buildSandboxSettings(['typescript'], { level, tables: IMPORT_RULE_TABLES[declarations] });
        await createFileTree(sandbox.path, { ...IMPORT_RULE_FILES, 'gspot.toml': settings });
        const eslint = await buildEslint(sandbox.path);
        const packages = JSON.parse(
            await readFile(join(sandbox.path, GSPOT_PATHS.npmProject), 'utf8'),
        ) as ToolPackageJson;
        const isEnabled = level === 'all' || declarations !== 'none';
        expect(Object.hasOwn(packages.devDependencies, 'eslint-plugin-boundaries')).toBe(isEnabled);
        if (!isEnabled) await unlink(join(sandbox.path, 'node_modules/eslint-plugin-boundaries'));
        expect(
            await listLintFindings(
                eslint,
                sandbox.path,
                ['app/source.ts', 'apps/api/app/source.ts'],
                ['boundaries/dependencies'],
            ),
        ).toStrictEqual(
            declarations === 'none'
                ? []
                : [
                      {
                          file: declarations === 'root' ? 'app/source.ts' : 'apps/api/app/source.ts',
                          rule: 'boundaries/dependencies',
                          line: 1,
                      },
                  ],
        );
        await Promise.all(
            ['app/source.ts', 'apps/api/app/source.ts'].map((file) =>
                writeFile(
                    join(sandbox.path, file),
                    "import { value } from './value.js';\nexport const result = value;\n",
                ),
            ),
        );
        expect(
            await listLintFindings(
                eslint,
                sandbox.path,
                ['app/source.ts', 'apps/api/app/source.ts'],
                ['boundaries/dependencies'],
            ),
        ).toStrictEqual([]);
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

    const eslint = await buildEslint(sandbox.path);
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
        ).toSorted((left, right) => compareText(left.file, right.file)),
    );
});

test('a file outside test_files may not import a test file, in root and child scopes, at all', async () => {
    await using sandbox = await testdir();
    const settings = buildSandboxSettings(['typescript'], {
        level: 'all',
        tables: APP_SCOPE_SETTINGS,
    });
    await createFileTree(sandbox.path, {
        'gspot.toml': settings,
        'package.json': '{"private":true,"type":"module"}',
        'tsconfig.json': TEST_IMPORT_TSCONFIG,
        'app/tsconfig.json': TEST_IMPORT_TSCONFIG,
        ...Object.fromEntries(
            ['', 'app/'].flatMap((prefix) =>
                Object.entries({
                    'src/value.ts': 'export const value = 1;\nexport type Value = number;\n',
                    'tests/value.ts': 'export const value = 1;\nexport type Value = number;\n',
                    'other/value.test.ts': 'export const value = 1;\n',
                } as const).map(([path, source]) => [prefix + path, source]),
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
    const eslint = await buildEslint(sandbox.path);
    for (const row of files) {
        expect(await listLintFindings(eslint, sandbox.path, [row.path], ['boundaries/dependencies'])).toStrictEqual(
            row.rejected ? [{ file: row.path, rule: 'boundaries/dependencies', line: 1 }] : [],
        );
    }
});

test('environment reads are allowed only in environment_readers files of each scope at all', async () => {
    await using sandbox = await testdir();
    const settings = buildSandboxSettings(['typescript'], { level: 'all', tables: ENVIRONMENT_TABLES });
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
    const eslint = await buildEslint(sandbox.path);
    for (const path of paths) {
        const isRejected = !['config/env.js', 'app/src/env/source.js', 'literal/config/env.js'].includes(path);
        for (const { source, rule } of ENVIRONMENT_CASES) {
            await createFileTree(sandbox.path, { [path]: source });
            expect(await listLintFindings(eslint, sandbox.path, [path], [rule])).toStrictEqual(
                isRejected ? [{ file: path, rule, line: 1 }] : [],
            );
        }
    }
});

test('without environment_readers, environment reads are allowed at level all', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}',
        'src/source.js': '',
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src/**/*.ts"]}',
    });

    const eslint = await buildEslint(sandbox.path);
    for (const { source, rule } of ENVIRONMENT_CASES) {
        await createFileTree(sandbox.path, { 'src/source.js': source });
        expect(await listLintFindings(eslint, sandbox.path, ['src/source.js'], [rule])).toStrictEqual([]);
    }
});

test('each file holds one import rule, the tRPC category comes first, and a refused import names the rule', async () => {
    await using sandbox = await testdir({
        ...IMPORT_RULE_FILES,
        'gspot.toml': buildSandboxSettings(['trpc', 'typescript'], {
            level: 'all',
            tables: `[trpc]\nserver_files = ["storage/**"]\n\n${IMPORT_RULE_TABLES.root}`,
        }),
        'app/source.ts': "import type { Value } from '../storage/value.js';\nexport type Result = Value;\n",
        'storage/value.ts': 'export type Value = number;\n',
    });

    const eslint = await buildEslint(sandbox.path);
    const [result] = await eslint.lintFiles(['app/source.ts']);
    expect(
        result?.messages.filter(({ ruleId }) => ruleId === 'boundaries/dependencies').map(({ message }) => message),
    ).toStrictEqual([
        'Import rule "app" may import only its own files, not ../storage/value.js from rule "storage". Move the code, move that rule above this one, or list the rules it may import in can_import.',
    ]);
});

test('an import of a javascript.externals specifier that resolves to a file passes its import rule, and other specifiers of that file are reported', async () => {
    const tables = `${IMPORT_RULE_TABLES.root}\n[javascript]\nexternals = { value = ["#host/*"], reason = "The host supplies this module." }\n`;
    await using sandbox = await testdir({
        ...IMPORT_RULE_FILES,
        'package.json':
            '{"private":true,"type":"module","imports":{"#host/value":"./storage/value.ts","#own/value":"./storage/value.ts"}}\n',
        'gspot.toml': buildSandboxSettings(['typescript'], { tables }),
        'app/source.ts':
            "import { value } from '#host/value';\nimport { value as own } from '#own/value';\nexport const result = value + own;\n",
    });
    const eslint = await buildEslint(sandbox.path);
    expect(await listLintFindings(eslint, sandbox.path, ['app/source.ts'], ['boundaries/dependencies'])).toStrictEqual([
        { file: 'app/source.ts', rule: 'boundaries/dependencies', line: 2 },
    ]);
});
