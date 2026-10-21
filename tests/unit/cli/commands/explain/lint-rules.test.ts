import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/run-gspot.ts';

test('a rule is explained with the page its manifest declares', async () => {
    await using sandbox = await testdir();
    const shellcheck = await runGspot(sandbox.path, ['explain', 'shellcheck/SC2086', '--json']);
    const shellcheckText = await runGspot(sandbox.path, ['explain', 'shellcheck/SC2086']);
    expect(JSON.parse(shellcheck.stdout)).toMatchObject({
        kind: 'lint-rule',
        tool: 'shellcheck',
        rule: 'SC2086',
        page: 'https://www.shellcheck.net/wiki/SC2086',
    });
    expect(shellcheckText.stdout).toContain('gspot ignore bash/shellcheck --rule SC2086');
    expect(shellcheckText.stdout).not.toContain('tools.shellcheck.rules');
    const undefinedNames = await runGspot(sandbox.path, ['explain', 'no-undef', '--json']);
    expect(JSON.parse(undefinedNames.stdout)).toMatchObject({
        kind: 'lint-rule',
        subject: 'eslint/no-undef',
        page: 'https://eslint.org/docs/latest/rules/no-undef',
    });
    const variableDeclarations = await runGspot(sandbox.path, ['explain', 'no-var', '--json']);
    expect(JSON.parse(variableDeclarations.stdout)).toMatchObject({
        kind: 'lint-rule',
        subject: 'eslint/no-var',
        page: 'https://eslint.org/docs/latest/rules/no-var',
    });
    const explicitVariableDeclarations = await runGspot(sandbox.path, ['explain', 'eslint/no-var', '--json']);
    expect(JSON.parse(explicitVariableDeclarations.stdout)).toMatchObject({
        page: 'https://eslint.org/docs/latest/rules/no-var',
    });
});

test.each([
    ['gspot/no-trivial-functions', 'https://generativespotting.com/reference/eslint-plugin/no-trivial-functions/'],
    ['@typescript-eslint/no-explicit-any', 'https://typescript-eslint.io/rules/no-explicit-any'],
    [
        'unicorn/prefer-set-has',
        'https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-set-has.md',
    ],
    [
        'eslint/unicorn/prefer-set-has',
        'https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-set-has.md',
    ],
    ['eslint/@typescript-eslint/no-explicit-any', 'https://typescript-eslint.io/rules/no-explicit-any'],
    ['eslint/sonarjs/no-identical-functions', null],
])('a plugin rule, with or without the eslint/ prefix, finds the page of its plugin: %s', async (subject, page) => {
    await using sandbox = await testdir();
    const subjectExplanation = await runGspot(sandbox.path, ['explain', subject, '--json']);
    expect(JSON.parse(subjectExplanation.stdout)).toMatchObject({
        kind: 'lint-rule',
        tool: 'eslint',
        page,
    });
});

test('a check explains the minimum version its declaring tool needs', async () => {
    await using sandbox = await testdir();
    const ruff = await runGspot(sandbox.path, ['explain', 'python/ruff']);
    expect(ruff.stdout + ruff.stderr).toContain('Needs ruff 0.9.0 or newer');
});

test('an unknown rule prefix is refused and names the subject', async () => {
    await using sandbox = await testdir();
    const refusal = await runGspot(sandbox.path, ['explain', 'unknown/no-such-rule']);
    expect(refusal.code).toBe(2);
    expect(refusal.stderr).toContain('gspot cannot explain unknown/no-such-rule.');
    const unknownEslintRule = await runGspot(sandbox.path, ['explain', 'eslint/unknown/no-such-rule', '--json']);
    expect(JSON.parse(unknownEslintRule.stdout)).toMatchObject({
        kind: 'lint-rule',
        tool: 'eslint',
        rule: 'unknown/no-such-rule',
        page: null,
    });
});

test('TypeScript errors have no rule options and no page link', async () => {
    await using sandbox = await testdir();
    const rule = await runGspot(sandbox.path, ['explain', 'tsc/TS2345', '--json']);
    const ruleText = await runGspot(sandbox.path, ['explain', 'tsc/TS2345']);
    expect(JSON.parse(rule.stdout)).toMatchObject({ kind: 'lint-rule', tool: 'tsc', rule: 'TS2345', page: null });
    expect(ruleText.stdout).toContain('Read the tsc documentation for TS2345.');
    expect(ruleText.stdout).not.toContain('Change its options:');
    expect(ruleText.stdout).not.toContain('tools.tsc.rules');
    expect(ruleText.stdout).not.toContain("The tool's page:");
    const javascriptCompiler = await runGspot(sandbox.path, ['explain', 'javascript/tsc', '--json']);
    expect(JSON.parse(javascriptCompiler.stdout)).toMatchObject({
        help: 'Add or fix the JSDoc type that the error names.',
    });
});

test('a plugin prefix with an npm scope must match a manifest declaration', async () => {
    await using sandbox = await testdir();
    const nextLink = await runGspot(sandbox.path, ['explain', '@next/next/no-html-link-for-pages', '--json']);
    expect(JSON.parse(nextLink.stdout)).toMatchObject({
        subject: 'eslint/@next/next/no-html-link-for-pages',
        tool: 'eslint',
        rule: '@next/next/no-html-link-for-pages',
        page: null,
    });
    const explicitNextLink = await runGspot(sandbox.path, [
        'explain',
        'eslint/@next/next/no-html-link-for-pages',
        '--json',
    ]);
    expect(JSON.parse(explicitNextLink.stdout)).toMatchObject({
        tool: 'eslint',
        rule: '@next/next/no-html-link-for-pages',
        page: null,
    });
    const refusal = await runGspot(sandbox.path, ['explain', 'typescript-eslint/no-explicit-any']);
    expect(refusal.code).toBe(2);
    expect(refusal.stderr).toContain('typescript-eslint/no-explicit-any');
    const unknownTypescriptPrefix = await runGspot(sandbox.path, [
        'explain',
        'eslint/typescript-eslint/no-explicit-any',
        '--json',
    ]);
    expect(JSON.parse(unknownTypescriptPrefix.stdout)).toMatchObject({ page: null });
});

test('explain finds rule pages from the root and from a child scope', async () => {
    await using sandbox = await testdir();
    const settings = `level = "all"
configurations = ["python"]
[[scope]]
path = "app"
configurations = ["swift"]
`;
    await createFileTree(sandbox.path, { 'gspot.toml': settings, 'app/sample.swift': 'let value = 1\n' });
    const root = await runGspot(sandbox.path, ['explain', 'ruff/F401', '--json']);
    expect(root.code, root.stdout + root.stderr).toBe(0);
    expect(JSON.parse(root.stdout)).toMatchObject({
        tool: 'ruff',
        rule: 'F401',
        check: 'python/ruff',
        page: 'https://docs.astral.sh/ruff/rules/F401/',
    });
    const child = await runGspot(join(sandbox.path, 'app'), ['explain', 'swiftlint/type_body_length', '--json']);
    expect(child.code, child.stdout + child.stderr).toBe(0);
    expect(JSON.parse(child.stdout)).toMatchObject({
        tool: 'swiftlint',
        rule: 'type_body_length',
        check: 'swift/swiftlint',
        page: 'https://realm.github.io/SwiftLint/type_body_length.html',
    });
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
});
