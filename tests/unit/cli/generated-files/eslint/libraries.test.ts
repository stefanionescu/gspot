import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { LEVELS } from '#cli/config/configurations.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import type { EslintConfiguration } from '#tests/types/tool-output.ts';
import { I18N_SOURCE } from '#tests/data/generated-files/eslint/framework.ts';
import { createEslint, collectLintFindings } from '#tests/setup/tool-files.ts';

import {
    QUERY_FILES,
    QUERY_FIXED,
    QUERY_SAMPLE,
    ZUSTAND_FILES,
    RESTRICTION_TABLES,
} from '#tests/data/generated-files/eslint/fragments.ts';

describe('drizzle', () => {
    test('Drizzle reports delete and update without where only for its client names', async () => {
        const level = 'all';
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': `level = "${level}"\nconfigurations = ["drizzle"]\n[[scope]]\npath = "app"\nconfigurations = ["drizzle"]\n[scope.drizzle]\nclient_names = ["connection"]\n`,
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
describe('tanstack-query', () => {
    test('TanStack Query reports a void query function and the mutation callback order', async () => {
        const level = 'all';
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...QUERY_FILES,
            'gspot.toml': buildSettingsText(['typescript', 'tanstack-query'], {
                level: level,
            }),
            'src/query.ts': QUERY_SAMPLE,
        });
        const eslint = await createEslint(sandbox.path);
        const rules = ['@tanstack/query/no-void-query-fn', '@tanstack/query/mutation-property-order'];
        const files = ['src/query.ts', 'src/neighbor.ts'];
        expect(await collectLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([
            { file: 'src/query.ts', rule: '@tanstack/query/no-void-query-fn', line: 2 },
            { file: 'src/query.ts', rule: '@tanstack/query/mutation-property-order', line: 3 },
        ]);
        await Bun.write(`${sandbox.path}/src/query.ts`, QUERY_FIXED);
        expect(await collectLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([]);
    });
});
describe('translations', () => {
    test.each([...LEVELS])('literal UI text is reported outside the test files of each scope at %s', async (level) => {
        await using sandbox = await testdir();
        const tested = ['qa/entry.jsx', 'app/qa/entry.jsx', 'app/verification/entry.jsx', 'app/deep/qa/entry.jsx'];
        const ordinary = new Set(['source.jsx', 'app/source.jsx', 'app/deep/source.jsx']);
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSettingsText(['translations', 'react'], {
                level,
                tables: 'test_files = [ "**/qa/**" ]\n\n[[scope]]\npath = "app"\ntest_files = [ "app/verification/**" ]\n\n[[scope]]\npath = "app/deep"\n\n[[scope]]\npath = "sibling"\nremoved_configurations = [ "translations" ]\n',
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
describe('zod', () => {
    test('Zod reports z.any() and keeps its schema rules', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'level = "all"\nconfigurations = ["zod"]\n',
            'package.json': JSON.stringify({ private: true, dependencies: { zod: '4.6.2' } }),
            'source.js': 'import { z } from "zod";\nexport const schema = z.object({ value: z.any() });\n',
        });
        const eslint = await createEslint(sandbox.path);
        const computed = (await eslint.calculateConfigForFile('source.js')) as EslintConfiguration;
        expect(computed.rules['zod/no-any-schema']![0]).toBe(2);
        expect(computed.rules['zod/prefer-strict-object']![0]).toBe(2);
        expect(await collectLintFindings(eslint, sandbox.path, ['source.js'], ['zod/no-any-schema'])).toStrictEqual([
            { file: 'source.js', rule: 'zod/no-any-schema', line: 2 },
        ]);
    });
});
describe('zustand', () => {
    test.each([...LEVELS])(
        '%s keeps your import restrictions in store files and the Zustand restriction elsewhere',
        async (level) => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                ...ZUSTAND_FILES,
                'gspot.toml': buildSettingsText(['javascript', 'zustand'], {
                    tables: RESTRICTION_TABLES,
                    level: level,
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
