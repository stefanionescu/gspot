import picomatch from 'picomatch';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';

import {
    buildFilePatterns,
    listCodeTestFiles,
} from '#cli/generation/configurations/language/javascript/eslint/files.ts';
import {
    NESTED_ESLINT_FILES,
    NESTED_ESLINT_PATHS,
    NESTED_ESLINT_RULES,
    WILDCARD_ESLINT_FILES,
} from '#tests/config/generation/configurations/language/javascript/eslint/files.ts';

test("a child scope's test_files and script_files get the test and script rule blocks", async () => {
    await using sandbox = await testdir({
        ...NESTED_ESLINT_FILES,
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level: 'all',
            tables: '[[scope]]\npath = "app"\ntest_files = ["app/spec/**"]\n[scope.javascript]\nscript_files = ["app/scripts/**"]\n',
        }),
    });
    const eslint = await createEslint(sandbox.path);
    expect(await listLintFindings(eslint, sandbox.path, NESTED_ESLINT_PATHS, NESTED_ESLINT_RULES)).toStrictEqual([
        { file: 'app/source.js', rule: 'no-console', line: 1 },
        { file: 'app/source.js', rule: 'n/no-process-exit', line: 2 },
    ]);
});

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
    const eslint = await createEslint(sandbox.path);
    expect(await listLintFindings(eslint, sandbox.path, ['app', 'sibling'], ['no-console'])).toStrictEqual([
        { file: 'sibling/build.js', rule: 'no-console', line: 1 },
        { file: 'sibling/read.js', rule: 'no-console', line: 1 },
    ]);
});
test('Node file patterns match a filename with a backslash and not its neighbor', () => {
    const file = String.raw`scripts/run\name`;
    const patterns = buildFilePatterns({ components: [], scopes: [], nodeFiles: [file] }).code;
    const matches = picomatch(patterns, { dot: true, windows: false });
    expect(matches(file)).toBe(true);
    expect(matches('scripts/runname')).toBe(false);
});

test('ESLint test patterns omit foreign extensions and retain components and shared globs', () => {
    expect(
        listCodeTestFiles([
            '**/test_*.py',
            '**/*_test.py',
            '**/*Tests.swift',
            '**/*.test.ts',
            '**/*.spec.vue',
            '**/*.test.svelte',
            '**/*.test.astro',
            '**/tests/**',
            '**/*.{js,ts}',
        ]),
    ).toStrictEqual([
        '**/*.test.ts',
        '**/*.spec.vue',
        '**/*.test.svelte',
        '**/*.test.astro',
        '**/tests/**',
        '**/*.{js,ts}',
    ]);
});
