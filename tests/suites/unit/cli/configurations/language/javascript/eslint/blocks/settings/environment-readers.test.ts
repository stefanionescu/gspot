import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

import { ENVIRONMENT_CASES, ENVIRONMENT_TABLES } from '#tests/config/configurations/javascript/blocks.ts';
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
