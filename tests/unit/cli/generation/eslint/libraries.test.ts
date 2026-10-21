import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { LEVELS } from '#cli/config/configurations.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { I18N_SOURCE } from '#tests/data/generation/eslint/framework.ts';
import { createEslint, collectLintFindings } from '#tests/setup/tool-files.ts';
import { ZUSTAND_FILES, RESTRICTION_TABLES } from '#tests/data/generation/eslint/configurations.ts';

describe('drizzle', () => {
    test('Drizzle reports delete and update without where only for its client names', async () => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['drizzle'], {
                level: 'all',
                rules: true,
                scopes: [{ path: 'app', configurations: ['drizzle'] }],
                tables: '[scope.drizzle]\nclient_names = ["connection"]\n',
            }),
            'source.js':
                'db.delete(table);\nother.delete(table);\nnew Map().delete(key);\nnew Set().delete(key);\nnew Headers().delete("header");\nnew URLSearchParams().delete("query");\n',
            'app/source.js': 'connection.update(table).set({ value: 1 });\nother.update(table).set({ value: 1 });\n',
        });

        const eslint = await createEslint(sandbox.path);
        const rules = ['drizzle/enforce-delete-with-where', 'drizzle/enforce-update-with-where'];
        expect(await collectLintFindings(eslint, sandbox.path, ['source.js', 'app/source.js'], rules)).toStrictEqual([
            { file: 'app/source.js', rule: 'drizzle/enforce-update-with-where', line: 1 },
            { file: 'source.js', rule: 'drizzle/enforce-delete-with-where', line: 1 },
        ]);
        await createFileTree(sandbox.path, {
            'app/source.js': 'connection.update(table).set({ value: 1 }).where(condition);\n',
        });
        expect(await collectLintFindings(eslint, sandbox.path, ['app/source.js'], rules)).toStrictEqual([]);
    });
});
describe('translations', () => {
    test.each([...LEVELS])('literal UI text is reported outside the test files of each scope at %s', async (level) => {
        await using sandbox = await testdir();
        const tested = ['qa/entry.jsx', 'app/qa/entry.jsx', 'app/verification/entry.jsx', 'app/deep/qa/entry.jsx'];
        const ordinary = new Set(['source.jsx', 'app/source.jsx', 'app/deep/source.jsx']);
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSandboxSettings(['translations', 'react'], {
                level,
                tables: 'test_files = [ "**/qa/**" ]\n\n[[scope]]\npath = "app"\ntest_files = [ "app/verification/**" ]\n\n[[scope]]\npath = "app/deep"\n\n[[scope]]\npath = "sibling"\nremoved_configurations = { value = [ "translations" ], reason = "This scope does not translate its UI text." }\n',
            }),
            'package.json': '{"private":true,"type":"module"}\n',
            ...Object.fromEntries([...tested, ...ordinary, 'sibling/source.jsx'].map((path) => [path, I18N_SOURCE])),
        });
        const eslint = await createEslint(sandbox.path);
        for (const file of [...tested, ...ordinary, 'sibling/source.jsx']) {
            expect(
                await collectLintFindings(eslint, sandbox.path, [file], ['i18next/no-literal-string']),
                file,
            ).toStrictEqual(
                level === 'all' && ordinary.has(file) ? [{ file, rule: 'i18next/no-literal-string', line: 1 }] : [],
            );
        }
    });
});
describe('zustand', () => {
    test.each([...LEVELS])(
        '%s keeps your import restrictions in store files and the Zustand restriction elsewhere',
        async (level) => {
            await using sandbox = await testdir({
                ...ZUSTAND_FILES,
                'gspot.toml': buildSandboxSettings(['javascript', 'zustand'], {
                    tables: RESTRICTION_TABLES,
                    level,
                }),
            });

            const eslint = await createEslint(sandbox.path);
            const files = ['src/widget.js', 'src/store.js'];
            expect(await collectLintFindings(eslint, sandbox.path, files, ['no-restricted-imports'])).toStrictEqual([
                { file: 'src/store.js', rule: 'no-restricted-imports', line: 2 },
                { file: 'src/widget.js', rule: 'no-restricted-imports', line: 1 },
                { file: 'src/widget.js', rule: 'no-restricted-imports', line: 2 },
            ]);
            for (const result of await eslint.lintFiles(files)) {
                expect(
                    result.messages.find(({ ruleId, line }) => ruleId === 'no-restricted-imports' && line === 2)
                        ?.message,
                ).toBe("'node:fs' import is restricted from being used. Use the storage service.");
            }
        },
    );
});
