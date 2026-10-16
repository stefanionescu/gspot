import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { unlink } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { parseToolProject } from '#cli/tools/npm/tool-project.ts';
import { createEslint, lintFindings, readEslintConfiguration } from '#tests/setup/generate.ts';

import {
    MODULE_CASES,
    FIXED_SOURCE,
    MODULE_FILES,
    MODULE_TABLES,
    QA_IMPORT_CASES,
    QA_MODULE_TABLES,
} from '#tests/config/eslint/architecture.ts';

test.each([...MODULE_CASES])(
    '$level loads eslint-plugin-boundaries for $declarations architecture modules',
    async ({ level, declarations }) => {
        await using sandbox = await testdir();
        const settings = settingsText(['typescript'], { level, tables: MODULE_TABLES[declarations] });
        await createFileTree(sandbox.path, { ...MODULE_FILES, 'gspot.toml': settings });
        const eslint = await createEslint(sandbox.path);
        const awaitedSession = await openSession(sandbox.path);
        const packages = parseToolProject(
            await Bun.file(join(sandbox.path, '.gspot/package.json')).text(),
            awaitedSession.requirePackageManager().name,
        );
        const enabled = level === 'all' || declarations !== 'none';
        expect(Object.hasOwn(packages.dependencies, 'eslint-plugin-boundaries')).toBe(enabled);
        expect(packages.dependencies['eslint-import-resolver-typescript']).toBeDefined();
        if (!enabled) await unlink(join(sandbox.path, 'node_modules/eslint-plugin-boundaries'));
        async function lintReport() {
            const files = ['app/source.ts', 'apps/api/app/source.ts'];
            const configured = [];
            for (const file of files) {
                const config = await readEslintConfiguration(eslint, file);
                configured.push({
                    plugin: Object.hasOwn(config.plugins, 'boundaries'),
                    classic: Object.hasOwn(config.settings, 'import/resolver'),
                    modern: Object.hasOwn(config.settings, 'import-x/resolver-next'),
                });
            }
            return {
                configured,
                findings: await lintFindings(eslint, sandbox.path, files, ['boundaries/dependencies']),
            };
        }
        const configured = [
            { plugin: enabled, classic: enabled, modern: true },
            { plugin: enabled, classic: enabled, modern: true },
        ];
        expect(await lintReport()).toStrictEqual({
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
                Bun.write(join(sandbox.path, file), FIXED_SOURCE),
            ),
        );
        expect(await lintReport()).toStrictEqual({ configured, findings: [] });
    },
);

test('module boundaries skip your test files in each scope and check other files', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['javascript'], { level: 'all', tables: QA_MODULE_TABLES }),
        'package.json': '{"name":"boundaries","private":true,"type":"module"}',
        'storage/value.js': 'export const value = 1;\n',
        'apps/api/storage/value.js': 'export const value = 1;\n',
        ...Object.fromEntries(
            QA_IMPORT_CASES.map(({ path, importPath }) => [
                path,
                `import { value } from '${importPath}';\nconsole.log(value);\n`,
            ]),
        ),
    });
    const eslint = await createEslint(sandbox.path);
    expect(
        await lintFindings(
            eslint,
            sandbox.path,
            QA_IMPORT_CASES.map(({ path }) => path),
            ['boundaries/dependencies'],
        ),
    ).toStrictEqual(
        QA_IMPORT_CASES.flatMap(({ path, count }) =>
            Array.from({ length: count }, () => ({ file: path, rule: 'boundaries/dependencies', line: 1 })),
        ).toSorted((left, right) => left.file.localeCompare(right.file)),
    );
});
