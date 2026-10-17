import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { LEVELS } from '#cli/config/configurations.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import type { EslintConfiguration } from '#tests/types/tool-output.ts';
import { createEslint, listScriptFindings, collectLintFindings } from '#tests/setup/tool-files.ts';

import {
    ENGINE_PATHS,
    ENGINE_PHASES,
    ENGINE_SOURCE,
    ENGINE_FINDINGS,
    ENGINE_PACKAGES,
} from '#tests/data/generated-files/eslint/engines.ts';
import {
    UNLINTED_FILES,
    NODE_SCRIPT_CASES,
    NODE_SCRIPT_FILES,
    NODE_SCRIPT_RULES,
    NODE_SCRIPT_TABLES,
    EXTENSIONLESS_SCRIPT_CASES,
    EXTENSIONLESS_SCRIPT_RULES,
} from '#tests/data/generated-files/eslint/node-scripts.ts';

test.each([...ENGINE_PHASES])('engines > Node checks follow package engines (%j)', async (phase) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
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

    await Bun.write(
        join(sandbox.path, 'gspot.toml'),
        buildSettingsText(['javascript'], { level: 'all', tables: phase.tables }),
    );
    for (const path of phase.corrections) {
        const source = await Bun.file(join(sandbox.path, path)).text();
        await Bun.write(
            join(sandbox.path, path),
            source
                .replace('Object.groupBy([1], String)', 'Object.fromEntries([["group", [1]]])')
                .replace('process.loadEnvFile()', 'process.cwd()'),
        );
    }
    const eslint = await createEslint(sandbox.path);
    const findings = await collectLintFindings(
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
});

test.each([...LEVELS])(
    'node-scripts > ESLint lints Node script files by role and shebang, and skips generated, vendored and other files (%s)',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...NODE_SCRIPT_FILES,
            'gspot.toml': buildSettingsText(['typescript'], { level, tables: NODE_SCRIPT_TABLES }),
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
                results: await collectLintFindings(eslint, sandbox.path, paths, NODE_SCRIPT_RULES),
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
    'node-scripts > Node scripts without an extension get syntax, global, engine, import and scope limit findings (%s)',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...NODE_SCRIPT_FILES,
            'gspot.toml': buildSettingsText(['typescript'], { level, tables: NODE_SCRIPT_TABLES }),
            ...Object.fromEntries(EXTENSIONLESS_SCRIPT_CASES.map(({ file, source }) => [file, source])),
            'source.js': 'export const value = 1;\n',
        });
        const eslint = await createEslint(sandbox.path);
        for (const corrected of [false, true]) {
            if (corrected)
                for (const contract of EXTENSIONLESS_SCRIPT_CASES)
                    await Bun.write(join(sandbox.path, contract.file), contract.corrected);
            const paths = EXTENSIONLESS_SCRIPT_CASES.map(({ file }) => file);
            const findings = await collectLintFindings(eslint, sandbox.path, paths, EXTENSIONLESS_SCRIPT_RULES);
            expect(findings).toStrictEqual(corrected ? [] : listScriptFindings(EXTENSIONLESS_SCRIPT_CASES, level));
        }
    },
);

test('package-json > every package.json gets the package-json rules and no code rules, also beside a test runner', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `level = "all"\nconfigurations = ["typescript", "vitest"]\n[rules]\nenabled = false\n`,
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
    const findings = await collectLintFindings(eslint, sandbox.path, files, rules);
    expect(findings.filter(({ rule }) => rule === 'package-json/sort-collections')).toStrictEqual([
        { file: 'package.json', rule: 'package-json/sort-collections', line: 1 },
        { file: 'tests/package.json', rule: 'package-json/sort-collections', line: 1 },
    ]);
    expect(findings.filter(({ rule }) => rule?.startsWith('package-json/') !== true)).toStrictEqual([]);
});

test('package-json > an ignore of a package-json rule for one file keeps the finding in other files', async () => {
    await using sandbox = await testdir();
    const manifest = { name: 'example', version: '0.0.0', type: 'module' };
    await createFileTree(sandbox.path, {
        'gspot.toml': `level = "all"
configurations = ["typescript"]
[[ignore]]
check = "javascript/eslint"
rule = "package-json/require-exports"
paths = ["cli/package.json"]
reason = "The command package exposes no module API."
[rules]
enabled = false
`,
        'package.json': JSON.stringify({ ...manifest, private: true }),
        'cli/package.json': JSON.stringify(manifest),
        'library/package.json': JSON.stringify(manifest),
    });
    const eslint = await createEslint(sandbox.path);
    expect(
        await collectLintFindings(
            eslint,
            sandbox.path,
            ['cli/package.json', 'library/package.json'],
            ['package-json/require-exports'],
        ),
    ).toStrictEqual([{ file: 'library/package.json', rule: 'package-json/require-exports', line: 1 }]);
});
