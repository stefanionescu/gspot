import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { LEVELS } from '#cli/config/configurations.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { lintFindings, createEslint, compareFindings } from '#tests/setup/generate.ts';

import {
    UNLINTED_FILES,
    NODE_SCRIPT_CASES,
    NODE_SCRIPT_FILES,
    NODE_SCRIPT_RULES,
    NODE_SCRIPT_TABLES,
    EXTENSIONLESS_SCRIPT_RULES,
    EXTENSIONLESS_SCRIPT_CASES,
} from '#tests/config/eslint/node-scripts.ts';

test.each([...LEVELS])(
    'ESLint lints Node script files by role and shebang, and skips generated, vendored and other files (%s)',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...NODE_SCRIPT_FILES,
            'gspot.toml': settingsText(['typescript'], { level, tables: NODE_SCRIPT_TABLES }),
        });
        const eslint = await createEslint(sandbox.path);
        const paths = NODE_SCRIPT_CASES.map(({ file }) => file);
        for (const corrected of [false, true]) {
            if (corrected)
                for (const { file, corrected } of NODE_SCRIPT_CASES)
                    await Bun.write(join(sandbox.path, file), corrected);
            const configurations = await Promise.all(
                UNLINTED_FILES.map(async (file) => ({
                    file,
                    matched: (await eslint.calculateConfigForFile(file)) !== undefined,
                })),
            );
            const findings = {
                results: await lintFindings(eslint, sandbox.path, paths, NODE_SCRIPT_RULES),
                configurations,
            };
            expect(findings).toStrictEqual({
                results: NODE_SCRIPT_CASES.flatMap((entry) =>
                    (corrected
                        ? []
                        : [...entry.recommended, ...(level === 'all' && 'all' in entry ? entry.all : [])]
                    ).map(({ ruleId, line }) => ({
                        file: entry.file,
                        rule: ruleId,
                        line,
                    })),
                ).toSorted(compareFindings),
                configurations: UNLINTED_FILES.map((file) => ({ file, matched: false })),
            });
        }
    },
);

test.each([...LEVELS])(
    'Node scripts without an extension get syntax, global, engine, import and scope limit findings (%s)',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...NODE_SCRIPT_FILES,
            'gspot.toml': settingsText(['typescript'], { level, tables: NODE_SCRIPT_TABLES }),
            ...Object.fromEntries(EXTENSIONLESS_SCRIPT_CASES.map(({ file, source }) => [file, source])),
            'source.js': 'export const value = 1;\n',
        });
        const eslint = await createEslint(sandbox.path);
        for (const corrected of [false, true]) {
            if (corrected)
                for (const contract of EXTENSIONLESS_SCRIPT_CASES)
                    await Bun.write(join(sandbox.path, contract.file), contract.corrected);
            const paths = EXTENSIONLESS_SCRIPT_CASES.map(({ file }) => file);
            const findings = await lintFindings(eslint, sandbox.path, paths, EXTENSIONLESS_SCRIPT_RULES);
            expect(findings).toStrictEqual(
                EXTENSIONLESS_SCRIPT_CASES.flatMap((entry) =>
                    (corrected
                        ? []
                        : [...entry.recommended, ...(level === 'all' && 'all' in entry ? entry.all : [])]
                    ).map(({ ruleId, line }) => ({
                        file: entry.file,
                        rule: ruleId,
                        line,
                    })),
                ).toSorted(compareFindings),
            );
        }
    },
);
