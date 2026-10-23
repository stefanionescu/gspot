import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { readFile, writeFile } from 'node:fs/promises';
import type { Level } from '#cli/types/configurations.ts';
import { LEVELS } from '#cli/config/configurations/names.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createEslint, compareFindings, listLintFindings } from '#tests/setup/eslint/lint.ts';
import type { LintFinding, ScriptFindingCase, EslintConfiguration } from '#tests/types/tools.ts';

import {
    ENGINE_PATHS,
    ENGINE_PHASES,
    ENGINE_SCOPES,
    ENGINE_SOURCE,
    UNLINTED_FILES,
    ENGINE_FINDINGS,
    ENGINE_PACKAGES,
    NODE_SCRIPT_CASES,
    NODE_SCRIPT_FILES,
    NODE_SCRIPT_RULES,
    NODE_SCRIPT_TABLES,
    PACKAGE_MANAGER_LEVELS,
    EXTENSIONLESS_SCRIPT_CASES,
    EXTENSIONLESS_SCRIPT_RULES,
} from '#tests/config/generation/configurations/language/javascript/eslint/node.ts';

test.each([...ENGINE_PHASES])(
    `ESLint reports Node APIs newer than the engines of each file's package ($name)`,
    async (phase) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all', tables: ENGINE_SCOPES }),
            ...ENGINE_PACKAGES,
            ...Object.fromEntries(
                ENGINE_PATHS.map((path) => [
                    path,
                    path.endsWith('.cjs')
                        ? ENGINE_SOURCE.replace('export const grouped =', 'exports.grouped =')
                        : ENGINE_SOURCE,
                ]),
            ),
        });

        for (const path of phase.corrections) {
            const source = await readFile(join(sandbox.path, path), 'utf8');
            await writeFile(
                join(sandbox.path, path),
                source
                    .replace('Object.groupBy([1], String)', 'Object.fromEntries([["group", [1]]])')
                    .replace('process.loadEnvFile()', 'process.cwd()'),
            );
        }
        const eslint = await createEslint(sandbox.path);
        const findings = await listLintFindings(
            eslint,
            sandbox.path,
            ENGINE_PATHS,
            ENGINE_FINDINGS.map(({ ruleId }) => ruleId),
        );
        expect(findings.toSorted((left, right) => left.file.localeCompare(right.file))).toStrictEqual(
            ENGINE_PATHS.toSorted((left, right) => left.localeCompare(right)).flatMap((file) =>
                new Set<string>(phase.reported).has(file)
                    ? ENGINE_FINDINGS.map(({ ruleId, line }) => ({ file, rule: ruleId, line }))
                    : [],
            ),
        );
    },
);

test.each([...LEVELS])(
    'ESLint lints Node script files by role and shebang, and skips generated, vendored and other files (%s)',
    async (level) => {
        await using sandbox = await testdir({
            ...NODE_SCRIPT_FILES,
            'gspot.toml': buildSandboxSettings(['typescript'], { level, tables: NODE_SCRIPT_TABLES }),
        });

        const eslint = await createEslint(sandbox.path);
        const paths = NODE_SCRIPT_CASES.map(({ file }) => file);
        for (const corrected of [false, true]) {
            if (corrected)
                for (const { file, corrected } of NODE_SCRIPT_CASES)
                    await writeFile(join(sandbox.path, file), corrected);
            const configurations = await Promise.all(
                UNLINTED_FILES.map(async (file) => ({
                    file,
                    matched: (await eslint.calculateConfigForFile(file)) !== undefined,
                })),
            );
            const findings = {
                results: await listLintFindings(eslint, sandbox.path, paths, NODE_SCRIPT_RULES),
                configurations,
            };
            expect(findings).toStrictEqual({
                results: corrected ? [] : listScriptFindings(NODE_SCRIPT_CASES, level),
                configurations: UNLINTED_FILES.map((file) => ({ file, matched: false })),
            });
        }
    },
);

test.each([...LEVELS])(
    'Node scripts without an extension get syntax, global, engine, import and scope limit findings (%s)',
    async (level) => {
        await using sandbox = await testdir({
            ...NODE_SCRIPT_FILES,
            'gspot.toml': buildSandboxSettings(['typescript'], { level, tables: NODE_SCRIPT_TABLES }),
            ...Object.fromEntries(EXTENSIONLESS_SCRIPT_CASES.map(({ file, source }) => [file, source])),
            'source.js': 'export const value = 1;\n',
        });

        const eslint = await createEslint(sandbox.path);
        for (const corrected of [false, true]) {
            if (corrected)
                for (const contract of EXTENSIONLESS_SCRIPT_CASES)
                    await writeFile(join(sandbox.path, contract.file), contract.corrected);
            const paths = EXTENSIONLESS_SCRIPT_CASES.map(({ file }) => file);
            const findings = await listLintFindings(eslint, sandbox.path, paths, EXTENSIONLESS_SCRIPT_RULES);
            expect(findings).toStrictEqual(corrected ? [] : listScriptFindings(EXTENSIONLESS_SCRIPT_CASES, level));
        }
    },
);

test('every package.json gets the package-json rules and no code rules, and only the root names its package manager', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript', 'vitest'], { level: 'all' }),
        'package.json':
            '{"name":"example","version":"1.0.0","private":true,"type":"module","dependencies":{"b":"1.0.0","a":"1.0.0"}}\n',
        'tests/package.json':
            '{"name":"test-tests","version":"1.0.0","private":true,"dependencies":{"b":"1.0.0","a":"1.0.0"}}\n',
    });

    const eslint = await createEslint(sandbox.path);
    const files = ['package.json', 'tests/package.json'];
    const configuration = await Promise.all(
        files.map(async (file) => (await eslint.calculateConfigForFile(file)) as EslintConfiguration),
    );
    const rules = [...new Set(configuration.flatMap((config) => Object.keys(config.rules)))];
    const findings = await listLintFindings(eslint, sandbox.path, files, rules);
    expect(findings.filter(({ rule }) => rule === 'package-json/sort-collections')).toStrictEqual([
        { file: 'package.json', rule: 'package-json/sort-collections', line: 1 },
        { file: 'tests/package.json', rule: 'package-json/sort-collections', line: 1 },
    ]);
    expect(findings.filter(({ rule }) => rule === 'package-json/require-packageManager')).toStrictEqual([
        { file: 'package.json', rule: 'package-json/require-packageManager', line: 1 },
    ]);
    expect(findings.filter(({ rule }) => rule?.startsWith('package-json/') !== true)).toStrictEqual([]);
});

test('an ignore of a package-json rule for one file keeps the finding in other files', async () => {
    await using sandbox = await testdir();
    const packageJson = { name: 'example', version: '0.0.0', type: 'module' };
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['typescript'], {
            level: 'all',
            tables: '[[ignore]]\ncheck = "javascript/eslint"\nrule = "package-json/require-exports"\npaths = ["cli/package.json"]\nreason = "The command package exposes no module API."\n',
        }),
        'package.json': JSON.stringify({ ...packageJson, private: true }),
        'cli/package.json': JSON.stringify(packageJson),
        'library/package.json': JSON.stringify(packageJson),
    });
    const eslint = await createEslint(sandbox.path);
    expect(
        await listLintFindings(
            eslint,
            sandbox.path,
            ['cli/package.json', 'library/package.json'],
            ['package-json/require-exports'],
        ),
    ).toStrictEqual([{ file: 'library/package.json', rule: 'package-json/require-exports', line: 1 }]);
});

test.each([...PACKAGE_MANAGER_LEVELS])(
    'the root package manager rule follows the manifest level ($level)',
    async ({ level, severity }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['javascript'], { level }),
            'package.json': '{"private":true,"type":"module"}',
        });
        const eslint = await createEslint(sandbox.path);
        const configuration = (await eslint.calculateConfigForFile('package.json')) as EslintConfiguration;
        expect(configuration.rules['package-json/require-packageManager']).toStrictEqual([severity]);
    },
);

function listScriptFindings(cases: readonly ScriptFindingCase[], level: Level): LintFinding[] {
    return cases
        .flatMap((cas) =>
            [...cas.recommended, ...(level === 'all' ? (cas.all ?? []) : [])].map(({ ruleId, line }) => ({
                file: cas.file,
                rule: ruleId,
                line,
            })),
        )
        .toSorted(compareFindings);
}
