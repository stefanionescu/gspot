import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

import { INDEX_ONLY_REEXPORTS } from '#tests/config/configurations/javascript/blocks.ts';
import { IMPORT_FILES, LEVEL_REEXPORT_CASES, REEXPORT_CASES } from '#tests/config/configurations/javascript/plugins.ts';
import { STRICT_TSCONFIG_TEXT } from '#tests/config/configurations/language.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';

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
