import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { createEslint } from '#tests/harness/generated.ts';
import type { ComputedEslint } from '#tests/types/cli/generation/configuration-files.ts';

import {
    BARREL_CASES,
    IMPORT_CASES,
    IMPORT_FILES,
    REEXPORT_CASES,
    NATIVE_POLICY_CASES,
} from '#tests/config/cli/generation/eslint/structure.ts';

test('generated all lint checks authored directories named after build outputs', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['javascript'], {
            tables: '[[generated]]\npaths = ["emitted/**"]\nreason = "The compiler owns these outputs."\n',
            level: 'all',
        }),
        'package.json': '{"private":true,"type":"module"}\n',
        'tests/build/check.js': 'missing();',
        'src/dist/check.js': 'missing();',
        'coverage/check.js': 'missing();',
        'emitted/check.js': 'missing();',
    });
    const eslint = await createEslint(sandbox.path);
    for (const filePath of ['tests/build/check.js', 'src/dist/check.js', 'coverage/check.js']) {
        expect(await eslint.isPathIgnored(filePath)).toBe(false);
        const findings = await eslint.lintText('missing();', { filePath });
        expect(findings.flatMap(({ messages }) => messages).some(({ ruleId }) => ruleId === 'no-undef')).toBe(true);
    }
    expect(await eslint.isPathIgnored('emitted/check.js')).toBe(true);
});

test.each(['recommended', 'all'])(
    'generated %s lint applies size limits in test files only at level all',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['javascript'], {
                tables: '[limits]\nfile_lines = 8\nfunction_lines = 5\nstatements = 3\n',
                level: level,
            }),
            'package.json': '{"private":true,"type":"module"}\n',
            'sample.test.js': '',
        });
        const eslint = await createEslint(sandbox.path);
        const rules = new Set(['max-lines', 'max-lines-per-function', 'max-statements']);
        const declarations = Array.from(
            { length: 9 },
            (_, index) => `    const value${String(index)} = ${String(index)};`,
        ).join('\n');
        const source = `export function count() {\n${declarations}\n    return value0;\n}\n`;
        const findings = await eslint.lintText(source, { filePath: 'sample.test.js' });
        for (const rule of rules)
            expect(findings.flatMap((file) => file.messages).some((diagnostic) => diagnostic.ruleId === rule)).toBe(
                level === 'all',
            );
    },
);

test.each(['recommended', 'all'])(
    'generated %s structural rules apply to root and nested files only at level all',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['javascript'], {
                tables: '[scope."app"]\nconfigurations = ["javascript"]\n',
                level: level,
            }),
            'package.json': '{"private":true,"type":"module"}\n',
            'main.js': '',
            'app/main.js': '',
        });
        const eslint = await createEslint(sandbox.path);
        for (const filePath of ['main.js', 'app/main.js']) {
            const findings = await eslint.lintText('export function start() { return launch(); }', { filePath });
            const rules = new Set(findings.flatMap((file) => file.messages).map((diagnostic) => diagnostic.ruleId));
            expect(rules.has('gspot/no-trivial-files')).toBe(level === 'all');
            expect(rules.has('gspot/no-trivial-functions')).toBe(false);
            const local = await eslint.lintText('function start() { return launch(); } export const app = start();', {
                filePath,
            });
            expect(
                local.flatMap(({ messages }) => messages).some(({ ruleId }) => ruleId === 'gspot/no-trivial-functions'),
            ).toBe(level === 'all');
        }
    },
);

test.each(['recommended', 'all'])(
    '%s exempts JSON attributes from declared JavaScript import extensions in root and nested scopes',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['javascript'], {
                tables: '[tools.eslint]\nimport_extensions = {"**/*" = "js"}\n[scope."app"]\nconfigurations = ["javascript"]\n',
                level,
            }),
            'package.json': '{"private":true,"type":"module","imports":{"#manifest":"./package.json"}}\n',
            'main.js': '',
            'app/main.js': '',
        });
        const eslint = await createEslint(sandbox.path);
        for (const filePath of ['main.js', 'app/main.js']) {
            const config = (await eslint.calculateConfigForFile(filePath)) as ComputedEslint;
            expect(config.rules['n/file-extension-in-import']![0]).toBe(2);
            const ordinary = await eslint.lintText('import manifest from "#manifest";', { filePath });
            expect(
                ordinary
                    .flatMap((file) => file.messages)
                    .filter(({ ruleId, fatal }) => ruleId === 'no-restricted-syntax' || fatal === true)
                    .map(({ ruleId, line }) => ({ ruleId, line })),
            ).toStrictEqual([{ ruleId: 'no-restricted-syntax', line: 1 }]);
            const metadata = await eslint.lintText('import manifest from "#manifest" with { type: "json" };', {
                filePath,
            });
            expect(
                metadata
                    .flatMap((file) => file.messages)
                    .filter(({ ruleId, fatal }) => ruleId === 'no-restricted-syntax' || fatal === true),
            ).toStrictEqual([]);
        }
    },
);

test.each(NATIVE_POLICY_CASES)('%s %s preserves native root and child import rules', async (level, reexports) => {
    await using sandbox = await testdir({
        ...IMPORT_FILES,
        'gspot.toml': buildPolicy(['typescript'], {
            level,
            tables: `[structure]\nreexports = "${reexports}"\n[limits]\nindex_exports = 2\n[scope.app]\nconfigurations = ["typescript"]\n[reasons]\n"limits.index_exports" = "This public module has two native exports."\n`,
        }),
    });
    const eslint = await createEslint(sandbox.path);
    for (const filePath of ['src/source.ts', 'app/src/source.ts']) {
        for (const [name, source, ruleId, count] of IMPORT_CASES) {
            const result = await eslint.lintText(source, { filePath });
            expect(
                result
                    .flatMap(({ messages }) => messages)
                    .filter((message) => message.ruleId === ruleId || message.fatal),
                name,
            ).toHaveLength(count);
        }
    }
    for (const [path, source] of Object.entries(IMPORT_FILES))
        expect(await Bun.file(`${sandbox.path}/${path}`).text()).toBe(source);
});

test.each(NATIVE_POLICY_CASES)(
    '%s %s preserves exact native reexport selectors and index exemptions',
    async (level, reexports) => {
        await using sandbox = await testdir({
            ...IMPORT_FILES,
            'gspot.toml': buildPolicy(['typescript'], {
                level,
                tables: `[structure]\nreexports = "${reexports}"\n[limits]\nindex_exports = 2\n[scope.app]\nconfigurations = ["typescript"]\n[reasons]\n"limits.index_exports" = "This public module has two native exports."\n`,
            }),
        });
        const eslint = await createEslint(sandbox.path);
        for (const filePath of ['src/source.ts', 'src/index.ts', 'app/src/source.ts', 'app/src/index.ts']) {
            for (const [source, count] of REEXPORT_CASES) {
                const result = await eslint.lintText(source, { filePath });
                expect(
                    result
                        .flatMap(({ messages }) => messages)
                        .filter(({ ruleId, fatal }) => ruleId === 'no-restricted-syntax' || fatal),
                ).toHaveLength(
                    level === 'all' && (reexports === 'none' || !filePath.endsWith('/index.ts')) ? count : 0,
                );
            }
        }
    },
);

test.each(NATIVE_POLICY_CASES)(
    '%s %s preserves the native barrel threshold and module classification',
    async (level, reexports) => {
        await using sandbox = await testdir({
            ...IMPORT_FILES,
            'gspot.toml': buildPolicy(['typescript'], {
                level,
                tables: `[structure]\nreexports = "${reexports}"\n[limits]\nindex_exports = 2\n[scope.app]\nconfigurations = ["typescript"]\n[reasons]\n"limits.index_exports" = "This public module has two native exports."\n`,
            }),
        });
        const eslint = await createEslint(sandbox.path);
        for (const filePath of ['src/index.ts', 'app/src/index.ts']) {
            for (const [name, source, count] of BARREL_CASES) {
                const result = await eslint.lintText(source, { filePath });
                expect(
                    result
                        .flatMap(({ messages }) => messages)
                        .filter(({ ruleId, fatal }) => ruleId === 'barrel-files/avoid-barrel-files' || fatal),
                    name,
                ).toHaveLength(level === 'all' && reexports === 'index-only' ? count : 0);
            }
        }
    },
);
