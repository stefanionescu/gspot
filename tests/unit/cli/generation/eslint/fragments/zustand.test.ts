import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { LEVELS } from '#cli/config/configurations.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { createEslint, lintFindings } from '#tests/setup/generate.ts';
import { ZUSTAND_FILES, RESTRICTION_TABLES } from '#tests/config/eslint/fragments.ts';

test.each([...LEVELS])(
    '%s keeps your import restrictions in store files and the Zustand restriction elsewhere',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...ZUSTAND_FILES,
            'gspot.toml': settingsText(['javascript', 'zustand'], { tables: RESTRICTION_TABLES, level: level }),
        });
        const eslint = await createEslint(sandbox.path);
        const files = ['src/widget.js', 'src/store.js'];
        expect(await lintFindings(eslint, sandbox.path, files, ['no-restricted-imports'])).toStrictEqual([
            { file: 'src/store.js', rule: 'no-restricted-imports', line: 2 },
            { file: 'src/widget.js', rule: 'no-restricted-imports', line: 1 },
            { file: 'src/widget.js', rule: 'no-restricted-imports', line: 2 },
        ]);
        for (const result of await eslint.lintFiles(files)) {
            expect(
                result.messages.find(({ ruleId, line }) => ruleId === 'no-restricted-imports' && line === 2)?.message,
            ).toBe("'node:fs' import is restricted from being used. Use the storage service.");
        }
    },
);
