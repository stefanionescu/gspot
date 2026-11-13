import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { listCodePatterns } from '#cli/configurations/language/javascript/eslint/files.ts';
import { compareText } from '#cli/system/text.ts';
import {
    EXTENSIONLESS_SCRIPT_CASES,
    EXTENSIONLESS_SCRIPT_RULES,
    NODE_SCRIPT_CASES,
    NODE_SCRIPT_FILES,
    NODE_SCRIPT_RULES,
    NODE_SCRIPT_TABLES,
    UNLINTED_FILES,
} from '#tests/config/configurations/javascript/node.ts';
import { NESTED_ESLINT_RULES } from '#tests/config/configurations/javascript/overrides.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';
import type { ScriptFindingCase } from '#tests/types/configurations.ts';
import type { LintFinding } from '#tests/types/setup.ts';

const NESTED_ESLINT_FILES = {
    'package.json': '{"private":true,"type":"module"}\n',
    'app/package.json':
        '{"name":"nested-app","version":"0.0.0-test","type":"module","devDependencies":{"zod":"0.0.0-test"}}\n',
    'app/spec/read.js':
        'import { z } from "zod";\nexport function read(value) { return z.string().parse(value); }\nconsole.log("test");\n',
    'app/scripts/build.js': 'console.log("script");\nprocess.exit(0);\n',
    'app/.mise/tasks/build.js': 'console.log("task");\nprocess.exit(0);\n',
    'app/source.js': 'console.log("source");\nprocess.exit(0);\n',
} as const;

const NESTED_ESLINT_PATHS = [
    'app/spec/read.js',
    'app/scripts/build.js',
    'app/.mise/tasks/build.js',
    'app/source.js',
] as const;

test("a child scope's test_files and script_files get the test and script rule blocks", async () => {
    await using sandbox = await testdir({
        ...NESTED_ESLINT_FILES,
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level: 'all',
            tables: '[[scope]]\npath = "app"\ntest_files = ["spec/**"]\n[scope.javascript]\nscript_files = ["scripts/**"]\n',
        }),
    });
    const eslint = await buildEslint(sandbox.path);
    expect(await listLintFindings(eslint, sandbox.path, NESTED_ESLINT_PATHS, NESTED_ESLINT_RULES)).toStrictEqual([
        { file: 'app/source.js', rule: 'no-console', line: 1 },
        { file: 'app/source.js', rule: 'n/no-process-exit', line: 2 },
    ]);
});

const WILDCARD_ESLINT_FILES = {
    'package.json': '{"private":true,"type":"module"}\n',
    'app/read.js': 'console.log("test");\n',
    'app/build.js': 'console.log("script");\n',
    'sibling/read.js': 'console.log("source");\n',
    'sibling/build.js': 'console.log("source");\n',
} as const;

test('a child scope wildcard exempts its tests and scripts without exempting sibling code', async () => {
    await using sandbox = await testdir({
        ...WILDCARD_ESLINT_FILES,
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level: 'all',
            rules: true,
            scopes: [{ path: 'app' }],
            tables: 'test_files = ["**/read.js"]\n[scope.javascript]\nscript_files = { value = ["**/build.js"], reason = "Nested build entrypoints are scripts in this scope." }\n',
        }),
    });
    const eslint = await buildEslint(sandbox.path);
    expect(await listLintFindings(eslint, sandbox.path, ['app', 'sibling'], ['no-console'])).toStrictEqual([
        { file: 'sibling/build.js', rule: 'no-console', line: 1 },
        { file: 'sibling/read.js', rule: 'no-console', line: 1 },
    ]);
});

test('ESLint test patterns omit foreign extensions and retain components and shared globs', () => {
    expect(
        listCodePatterns([
            '**/test_*.py',
            '**/*.test.ts',
            '**/*.spec.vue',
            '**/*.test.astro',
            '**/tests/**',
            '**/*.{js,ts}',
        ]),
    ).toStrictEqual(['**/*.test.ts', '**/*.spec.vue', '**/*.test.astro', '**/tests/**', '**/*.{js,ts}']);
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
