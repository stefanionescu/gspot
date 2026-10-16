import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { captureRejection } from '#tests/setup/matchers.ts';
import { runGspot, runRegisteredCommand } from '#tests/setup/run-gspot.ts';

test('a rule is explained with the page its manifest declares', async () => {
    await using sandbox = await testdir();
    const shellcheck = await runRegisteredCommand(sandbox.path, ['explain', 'shellcheck/SC2086']);
    expect(shellcheck.json).toMatchObject({
        kind: 'lint-rule',
        tool: 'shellcheck',
        rule: 'SC2086',
        page: 'https://www.shellcheck.net/wiki/SC2086',
    });
    expect(shellcheck.text).toContain('gspot ignore bash/shellcheck --rule SC2086');
    expect(shellcheck.text).not.toContain('tools.shellcheck.rules');
    const undefinedNames = await runRegisteredCommand(sandbox.path, ['explain', 'no-undef']);
    expect(undefinedNames.json).toMatchObject({
        kind: 'lint-rule',
        subject: 'eslint/no-undef',
        page: 'https://eslint.org/docs/latest/rules/no-undef',
    });
    const variableDeclarations = await runRegisteredCommand(sandbox.path, ['explain', 'no-var']);
    expect(variableDeclarations.json).toMatchObject({
        kind: 'lint-rule',
        subject: 'eslint/no-var',
        page: 'https://eslint.org/docs/latest/rules/no-var',
    });
    const explicitVariableDeclarations = await runRegisteredCommand(sandbox.path, ['explain', 'eslint/no-var']);
    expect(explicitVariableDeclarations.json).toMatchObject({
        page: 'https://eslint.org/docs/latest/rules/no-var',
    });
});

test('a plugin rule is explained with the page of the plugin its prefix names', async () => {
    await using sandbox = await testdir();
    const setMembership = await runRegisteredCommand(sandbox.path, ['explain', 'eslint/unicorn/prefer-set-has']);
    expect(setMembership.json).toMatchObject({
        page: 'https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-set-has.md',
    });
    const typescriptAny = await runRegisteredCommand(sandbox.path, [
        'explain',
        'eslint/@typescript-eslint/no-explicit-any',
    ]);
    expect(typescriptAny.json).toMatchObject({
        page: 'https://typescript-eslint.io/rules/no-explicit-any',
    });
    const identicalFunctions = await runRegisteredCommand(sandbox.path, [
        'explain',
        'eslint/sonarjs/no-identical-functions',
    ]);
    expect(identicalFunctions.json).toMatchObject({
        page: null,
    });
});

test.each([
    ['gspot/no-trivial-functions', 'https://generativespotting.com/reference/eslint-plugin/no-trivial-functions/'],
    ['@typescript-eslint/no-explicit-any', 'https://typescript-eslint.io/rules/no-explicit-any'],
    [
        'unicorn/prefer-set-has',
        'https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-set-has.md',
    ],
])('a plugin rule without the eslint/ prefix finds its page: %s', async (subject, page) => {
    await using sandbox = await testdir();
    const subjectExplanation = await runRegisteredCommand(sandbox.path, ['explain', subject]);
    expect(subjectExplanation.json).toMatchObject({
        kind: 'lint-rule',
        tool: 'eslint',
        page,
    });
});

test('a check explains the minimum version its declaring tool needs', async () => {
    await using sandbox = await testdir();
    const ruff = await runRegisteredCommand(sandbox.path, ['explain', 'python/ruff']);
    expect(ruff.text).toContain('Needs ruff 0.9.0 or newer');
});

test('an unknown rule prefix is refused and names the subject', async () => {
    await using sandbox = await testdir();
    const refusal = await captureRejection(runRegisteredCommand(sandbox.path, ['explain', 'unknown/no-such-rule']));
    expect(refusal).toContain('gspot cannot explain unknown/no-such-rule.');
    const unknownEslintRule = await runRegisteredCommand(sandbox.path, ['explain', 'eslint/unknown/no-such-rule']);
    expect(unknownEslintRule.json).toMatchObject({
        kind: 'lint-rule',
        tool: 'eslint',
        rule: 'unknown/no-such-rule',
        page: null,
    });
});

test('TypeScript errors have no rule options and no page link', async () => {
    await using sandbox = await testdir();
    const rule = await runRegisteredCommand(sandbox.path, ['explain', 'tsc/TS2345']);
    expect(rule.json).toMatchObject({ kind: 'lint-rule', tool: 'tsc', rule: 'TS2345', page: null });
    expect(rule.text).toContain('Read the tsc documentation for TS2345.');
    expect(rule.text).not.toContain('Change its options:');
    expect(rule.text).not.toContain('tools.tsc.rules');
    expect(rule.text).not.toContain("The tool's page:");
    const javascriptCompiler = await runRegisteredCommand(sandbox.path, ['explain', 'javascript/tsc']);
    expect(javascriptCompiler.json).toMatchObject({
        help: 'Add or fix the JSDoc type that the error names.',
    });
});

test('a plugin prefix with an npm scope must match a manifest declaration', async () => {
    await using sandbox = await testdir();
    const nextLink = await runRegisteredCommand(sandbox.path, ['explain', '@next/next/no-html-link-for-pages']);
    expect(nextLink.json).toMatchObject({
        subject: 'eslint/@next/next/no-html-link-for-pages',
        tool: 'eslint',
        rule: '@next/next/no-html-link-for-pages',
        page: null,
    });
    const explicitNextLink = await runRegisteredCommand(sandbox.path, [
        'explain',
        'eslint/@next/next/no-html-link-for-pages',
    ]);
    expect(explicitNextLink.json).toMatchObject({
        tool: 'eslint',
        rule: '@next/next/no-html-link-for-pages',
        page: null,
    });
    const refusal = await captureRejection(
        runRegisteredCommand(sandbox.path, ['explain', 'typescript-eslint/no-explicit-any']),
    );
    expect(refusal).toContain('typescript-eslint/no-explicit-any');
    const unknownTypescriptPrefix = await runRegisteredCommand(sandbox.path, [
        'explain',
        'eslint/typescript-eslint/no-explicit-any',
    ]);
    expect(unknownTypescriptPrefix.json).toMatchObject({ page: null });
});

test('rule pages work in the root and in a child scope', async () => {
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
    expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(settings);
});
