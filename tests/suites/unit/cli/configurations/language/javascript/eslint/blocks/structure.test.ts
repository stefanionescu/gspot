import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

import { ENVIRONMENT_CASES, ENVIRONMENT_TABLES } from '#tests/config/configurations/javascript/blocks.ts';
import {
    IMPORT_FILES,
    INDEX_ONLY_REEXPORTS,
    LEVEL_REEXPORT_CASES,
    REEXPORT_CASES,
} from '#tests/config/configurations/javascript/plugins.ts';
import { STRICT_TSCONFIG_TEXT } from '#tests/config/configurations/language.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';

test('environment reads are allowed only in environment_readers files of each scope at all', async () => {
    await using sandbox = await testdir();
    const settings = buildSandboxSettings(['typescript'], { level: 'all', tables: ENVIRONMENT_TABLES });
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

test.each(['none', 'index-only'])(
    'Next.js page files may only forward and follow reexports = %s in nested scopes',
    async (reexports) => {
        await using sandbox = await testdir();
        const files = [
            'app/page.tsx',
            'app/index.ts',
            'app/format.ts',
            'app/value.ts',
            'library/page.tsx',
            'library/value.ts',
        ];
        await createFileTree(sandbox.path, {
            'tsconfig.json': STRICT_TSCONFIG_TEXT,
            'gspot.toml': buildSandboxSettings(['typescript'], {
                level: 'all',
                rules: true,
                tables: `[structure]
reexports = ${reexports === 'index-only' ? INDEX_ONLY_REEXPORTS : '"none"'}
[[scope]]
path = "app"
configurations = ["nextjs"]
`,
            }),
            ...Object.fromEntries(files.map((file) => [file, 'export const value = 1;\n'])),
        });
        const eslint = await buildEslint(sandbox.path);
        const forwarding = 'import { value } from "./value.js";\nexport { value };\n';
        for (const file of ['app/page.tsx', 'app/format.ts', 'library/page.tsx']) {
            await createFileTree(sandbox.path, { [file]: forwarding });
            expect(await listLintFindings(eslint, sandbox.path, [file], ['gspot/no-trivial-files'])).toStrictEqual(
                file === 'app/page.tsx' ? [] : [{ file, rule: 'gspot/no-trivial-files', line: 1 }],
            );
        }
        for (const file of ['app/page.tsx', 'app/index.ts']) {
            await createFileTree(sandbox.path, { [file]: 'export * from "./format.js";\n' });
            expect(await listLintFindings(eslint, sandbox.path, [file], ['gspot/no-trivial-files'])).toStrictEqual(
                file === 'app/index.ts' && reexports === 'index-only'
                    ? []
                    : [{ file, rule: 'gspot/no-trivial-files', line: 1 }],
            );
        }
    },
);

test.each([...LEVEL_REEXPORT_CASES])(
    'at %s with reexports = %s, the re-export limit applies in root and child scopes',
    async (level, reexports) => {
        await using sandbox = await testdir({
            ...IMPORT_FILES,
            'gspot.toml': buildSandboxSettings(['typescript'], {
                level,
                tables: `[structure]\nreexports = ${reexports === 'index-only' ? INDEX_ONLY_REEXPORTS : '"none"'}\n[[scope]]\npath = "app"\nconfigurations = ["typescript"]\n`,
            }),
        });
        const eslint = await buildEslint(sandbox.path);
        for (const file of ['src/source.ts', 'src/index.ts', 'app/src/source.ts', 'app/src/index.ts']) {
            const isBanned = level === 'all' && (reexports === 'none' || !file.endsWith('/index.ts'));
            for (const [source, count] of REEXPORT_CASES) {
                await createFileTree(sandbox.path, { [file]: source });
                expect(
                    await listLintFindings(eslint, sandbox.path, [file], ['gspot/no-trivial-files']),
                    `${file}: ${source}`,
                ).toStrictEqual(
                    Array.from({ length: isBanned ? count : 0 }, () => ({
                        file,
                        rule: 'gspot/no-trivial-files',
                        line: 1,
                    })),
                );
            }
        }
    },
);
