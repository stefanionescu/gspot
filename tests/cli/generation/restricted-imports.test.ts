// User restrictions coexist with configuration restrictions at their declared levels and paths.
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { createEslint } from '#tests/harness/generated.ts';
import type { ResolvedEslint } from '#tests/types/generation/configuration-files.ts';
import { POLICY, PROJECT, STORE_EXTENSIONS } from '#tests/config/cli/generation/restricted-imports.ts';

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
                              "'create' import from 'zustand' is restricted. Create a store in a store file, once for the module, and export its hook.",
                      },
                  ]
                : [],
        );
    },
);

test.each(STORE_EXTENSIONS)(
    'Zustand permits its default %s store paths and retains neighboring import restrictions',
    async (extension) => {
        await using sandbox = await testdir();
        const commonjs = extension === 'cjs';
        const source = commonjs
            ? 'const { create } = require("zustand");\nmodule.exports = create(() => ({ open: false }));\n'
            : 'import { create } from "zustand";\nexport const useWidgetStore = create(() => ({ open: false }));\n';
        const stores = [
            `src/store.${extension}`,
            `src/stores/cart.${extension}`,
            `src/store/cart.${extension}`,
            `src/cart.store.${extension}`,
        ];
        const component = `src/widget.${extension}`;
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['typescript', 'zustand'], {
                level: 'all',
                tables: '[agent_rules]\nenabled = false\n',
            }),
            'package.json': PROJECT['package.json'],
            'tsconfig.json': '{"compilerOptions":{"strict":true,"allowJs":true},"include":["src"]}',
            ...Object.fromEntries([...stores, component].map((path) => [path, source])),
        });
        const eslint = await createEslint(sandbox.path);
        for (const path of stores) {
            const config = (await eslint.calculateConfigForFile(path)) as ResolvedEslint;
            expect(config.rules['no-restricted-imports']).toBeUndefined();
        }
        const neighbor = (await eslint.calculateConfigForFile(component)) as ResolvedEslint;
        expect(neighbor.rules['no-restricted-imports']?.[0]).toBe(2);
        const failed = await eslint.lintFiles([...stores, component]);
        expect(failed.flatMap(({ messages }) => messages.filter(({ fatal }) => fatal === true))).toStrictEqual([]);
        expect(
            failed.flatMap(({ filePath, messages }) =>
                messages
                    .filter(({ ruleId }) => ruleId === 'no-restricted-imports')
                    .map(({ line }) => ({ file: filePath.slice(sandbox.path.length + 1), line })),
            ),
        ).toStrictEqual(commonjs ? [] : [{ file: component, line: 1 }]);
        const corrected = await eslint.lintText(
            commonjs ? 'module.exports = "Widget";\n' : 'export const title = "Widget";\n',
            { filePath: component },
        );
        expect(
            corrected.flatMap(({ messages }) =>
                messages.filter(({ ruleId, fatal }) => fatal === true || ruleId === 'no-restricted-imports'),
            ),
        ).toStrictEqual([]);
        expect(await Promise.all(stores.map((path) => Bun.file(`${sandbox.path}/${path}`).text()))).toStrictEqual(
            stores.map(() => source),
        );
    },
);
