// User restrictions coexist with configuration restrictions at their declared levels and paths.
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { createEslint } from '#tests/harness/generated.ts';
import type { ComputedEslint } from '#tests/types/generation/configuration-files.ts';
import { POLICY, PROJECT, STORE_FILES } from '#tests/config/cli/generation/eslint/restricted-imports.ts';

test.each(['recommended', 'all'] as const)(
    '%s retains authored imports in store files and configuration restrictions elsewhere',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...PROJECT,
            'gspot.toml': buildPolicy(['javascript', 'zustand'], { tables: POLICY, level: level }),
        });
        const eslint = await createEslint(sandbox.path);
        const results = await eslint.lintFiles(['src/widget.js', 'src/store.js']);
        const restrictions = results.flatMap(({ filePath, messages }) =>
            messages
                .filter(({ ruleId }) => ruleId === 'no-restricted-imports')
                .map(({ line, message: diagnostic }) => ({
                    file: filePath.slice(sandbox.path.length + 1),
                    line,
                    message: diagnostic,
                })),
        );
        expect(restrictions).toContainEqual({
            file: 'src/widget.js',
            line: 2,
            message: "'node:fs' import is restricted from being used. Use the storage service.",
        });
        expect(restrictions).toContainEqual({
            file: 'src/store.js',
            line: 2,
            message: "'node:fs' import is restricted from being used. Use the storage service.",
        });
        expect(restrictions.filter(({ line }) => line === 1)).toStrictEqual(
            level === 'all'
                ? [
                      {
                          file: 'src/widget.js',
                          line: 1,
                          message:
                              "'create' import from 'zustand' is restricted. Create the store inside a factory that a provider owns, not as a module-level store.",
                      },
                  ]
                : [],
        );
    },
);

test('Zustand exempts all eight default module store extensions from configuration restrictions', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript', 'zustand'], { level: 'all' }),
        'package.json': PROJECT['package.json'],
        'tsconfig.json': '{"compilerOptions":{"strict":true,"allowJs":true},"include":["src"]}',
    });
    const eslint = await createEslint(sandbox.path);
    for (const path of STORE_FILES) {
        const config = (await eslint.calculateConfigForFile(path)) as ComputedEslint | undefined;
        expect(config, path).toBeDefined();
        expect(config?.rules['no-restricted-imports']).toBeUndefined();
    }
});
