import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

import { compareText } from '#cli/system/text.ts';
import {
    ENGINE_FINDINGS,
    ENGINE_PACKAGES,
    ENGINE_PATHS,
    ENGINE_SCOPES,
    ENGINE_SOURCE,
    EXTENSIONLESS_SCRIPT_CASES,
    EXTENSIONLESS_SCRIPT_RULES,
    NODE_SCRIPT_CASES,
    NODE_SCRIPT_FILES,
    NODE_SCRIPT_RULES,
    NODE_SCRIPT_TABLES,
    UNLINTED_FILES,
} from '#tests/config/configurations/javascript/node.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';
import type { ScriptFindingCase } from '#tests/types/configurations.ts';
import type { EslintConfiguration, LintFinding } from '#tests/types/setup.ts';

test(`ESLint reports Node APIs newer than the engines of each file's package`, async () => {
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

    const eslint = await buildEslint(sandbox.path);
    const findings = await listLintFindings(
        eslint,
        sandbox.path,
        ENGINE_PATHS,
        ENGINE_FINDINGS.map(({ ruleId }) => ruleId),
    );
    expect(findings.toSorted((left, right) => compareText(left.file, right.file))).toStrictEqual(
        ['old/source.cjs', 'old/source.js'].flatMap((file) =>
            ENGINE_FINDINGS.map(({ ruleId, line }) => ({ file, rule: ruleId, line })),
        ),
    );
});

test('ESLint lints Node script files by role and shebang, and skips generated, vendored and other files', async () => {
    await using sandbox = await testdir({
        ...NODE_SCRIPT_FILES,
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all', tables: NODE_SCRIPT_TABLES }),
    });

    const eslint = await buildEslint(sandbox.path);
    const paths = NODE_SCRIPT_CASES.map(({ file }) => file);
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
        results: buildExpectedFindings(NODE_SCRIPT_CASES),
        configurations: UNLINTED_FILES.map((file) => ({ file, matched: false })),
    });
});

test('Node scripts without an extension get syntax, global, engine, import and scope limit findings', async () => {
    await using sandbox = await testdir({
        ...NODE_SCRIPT_FILES,
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all', tables: NODE_SCRIPT_TABLES }),
        ...Object.fromEntries(EXTENSIONLESS_SCRIPT_CASES.map(({ file, source }) => [file, source])),
        'source.js': 'export const value = 1;\n',
    });

    const eslint = await buildEslint(sandbox.path);
    for (const isCorrected of [false, true]) {
        if (isCorrected)
            for (const contract of EXTENSIONLESS_SCRIPT_CASES)
                await writeFile(join(sandbox.path, contract.file), contract.corrected);
        const paths = EXTENSIONLESS_SCRIPT_CASES.map(({ file }) => file);
        const findings = await listLintFindings(eslint, sandbox.path, paths, EXTENSIONLESS_SCRIPT_RULES);
        expect(findings).toStrictEqual(isCorrected ? [] : buildExpectedFindings(EXTENSIONLESS_SCRIPT_CASES));
    }
});

test('every package.json gets the package-json rules and no code rules, and only the root names its package manager', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript', 'vitest'], { level: 'all' }),
        'package.json':
            '{"name":"example","version":"1.0.0","private":true,"type":"module","dependencies":{"b":"1.0.0","a":"1.0.0"}}\n',
        'tests/package.json':
            '{"name":"test-tests","version":"1.0.0","private":true,"dependencies":{"b":"1.0.0","a":"1.0.0"}}\n',
    });

    const eslint = await buildEslint(sandbox.path);
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
    const eslint = await buildEslint(sandbox.path);
    expect(
        await listLintFindings(
            eslint,
            sandbox.path,
            ['cli/package.json', 'library/package.json'],
            ['package-json/require-exports'],
        ),
    ).toStrictEqual([{ file: 'library/package.json', rule: 'package-json/require-exports', line: 1 }]);
});

function buildExpectedFindings(cases: readonly ScriptFindingCase[]): LintFinding[] {
    return cases
        .flatMap((row) =>
            [...row.everyLevel, ...(row.all ?? [])].map(({ ruleId, line }) => ({
                file: row.file,
                rule: ruleId,
                line,
            })),
        )
        .toSorted((left, right) => {
            if (left.file !== right.file) return compareText(left.file, right.file);
            return left.line === right.line ? compareText(left.rule ?? '', right.rule ?? '') : left.line - right.line;
        });
}
