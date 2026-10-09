import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import * as platform from '#cli/platform/public.ts';
import { explain } from '#cli/commands/explain/public.ts';

test('a rule is explained with the page its manifest declares', () => {
    const shellcheck = explain(undefined, 'shellcheck/SC2086');
    expect(shellcheck).toMatchObject({
        kind: 'tool-rule',
        data: { tool: 'shellcheck', rule: 'SC2086', page: 'https://www.shellcheck.net/wiki/SC2086' },
    });
    expect(shellcheck.text).toContain('gspot ignore bash/shellcheck --rule SC2086');
    expect(shellcheck.text).not.toContain('tools.shellcheck.rules');
    expect(explain(undefined, 'no-undef')).toMatchObject({
        kind: 'tool-rule',
        subject: 'eslint/no-undef',
        data: { page: 'https://eslint.org/docs/latest/rules/no-undef' },
    });
    expect(explain(undefined, 'no-var')).toMatchObject({
        kind: 'tool-rule',
        subject: 'eslint/no-var',
        data: { page: 'https://eslint.org/docs/latest/rules/no-var' },
    });
    expect(explain(undefined, 'eslint/no-var')).toMatchObject({
        data: { page: 'https://eslint.org/docs/latest/rules/no-var' },
    });
});

test('a plugin rule is explained with the page of the plugin whose prefix it carries', () => {
    expect(explain(undefined, 'eslint/unicorn/prefer-set-has')).toMatchObject({
        data: { page: 'https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-set-has.md' },
    });
    expect(explain(undefined, 'eslint/@typescript-eslint/no-explicit-any')).toMatchObject({
        data: { page: 'https://typescript-eslint.io/rules/no-explicit-any' },
    });
    expect(explain(undefined, 'eslint/sonarjs/no-identical-functions')).toMatchObject({ data: { page: null } });
});

test.each([
    ['gspot/no-trivial-functions', 'https://generativespotting.com/reference/plugin/no-trivial-functions/'],
    ['@typescript-eslint/no-explicit-any', 'https://typescript-eslint.io/rules/no-explicit-any'],
    [
        'unicorn/prefer-set-has',
        'https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-set-has.md',
    ],
])('raw plugin rule %s resolves its declared documentation', (subject, page) => {
    expect(explain(undefined, subject)).toMatchObject({ kind: 'tool-rule', data: { tool: 'eslint', page } });
});

test('check explanations add no absent metadata', () => {
    const format = explain(undefined, 'python/ruff-format');
    expect(format).toMatchObject({ kind: 'check', data: { configuration: 'python' } });
    expect(format).not.toHaveProperty('data.path_prefix');
});

test('native version prerequisites belong to their consuming check', () => {
    const bats = explain(undefined, 'bash/bats-syntax');
    expect(bats).toMatchObject({ data: { min_versions: { bash: '4.4.0' } } });
    expect(bats.text).toContain('Required native version: bash >= 4.4.0');
    const syntax = explain(undefined, 'bash/bash-syntax');
    expect(syntax).not.toHaveProperty('data.min_versions');
    expect(syntax.text).not.toContain('Required native version:');
});

test('an unknown raw rule namespace is refused with the requested subject', () => {
    expect(() => explain(undefined, 'unknown/no-such-rule')).toThrow('There is no check called `unknown/no-such-rule`');
    expect(explain(undefined, 'eslint/unknown/no-such-rule')).toMatchObject({
        kind: 'tool-rule',
        data: { tool: 'eslint', rule: 'unknown/no-such-rule', page: null },
    });
});

test('TypeScript errors have no invented rule options or error-page link', () => {
    const rule = explain(undefined, 'tsc/TS2345');
    expect(rule).toMatchObject({ kind: 'tool-rule', data: { tool: 'tsc', rule: 'TS2345', page: null } });
    expect(rule.text).toContain('Read the tsc documentation for TS2345.');
    expect(rule.text).not.toContain('Change its options:');
    expect(rule.text).not.toContain('tools.tsc.rules');
    expect(rule.text).not.toContain("The tool's page:");
    expect(explain(undefined, 'javascript/tsc')).toMatchObject({
        data: { help: 'Add or fix the JSDoc type that the error names.' },
    });
});

test('declared native rule pages need no tool executable or summary process', () => {
    using command = spyOn(platform, 'runBlocking').mockImplementation(() => {
        throw new Error('Rule explanations must not run a tool.');
    });
    const ruff = explain(undefined, 'ruff/F401');
    expect(ruff).toMatchObject({
        data: { tool: 'ruff', rule: 'F401', summary: null, page: 'https://docs.astral.sh/ruff/rules/F401/' },
    });
    expect(ruff.text).toContain("The tool's page: https://docs.astral.sh/ruff/rules/F401/");
    expect(ruff.text).toContain('gspot ignore python/ruff --rule F401');
    expect(ruff.text).not.toContain('The tool says:');
    const swiftlint = explain(undefined, 'swiftlint/type_body_length');
    expect(swiftlint).toMatchObject({
        data: { page: 'https://realm.github.io/SwiftLint/type_body_length.html', summary: null },
    });
    expect(swiftlint.text).toContain('gspot ignore swift/swiftlint --rule type_body_length');
    expect(command).not.toHaveBeenCalled();
});

test('native scoped plugin prefixes are exact manifest declarations', () => {
    expect(explain(undefined, '@next/next/no-html-link-for-pages')).toMatchObject({
        subject: 'eslint/@next/next/no-html-link-for-pages',
        data: { tool: 'eslint', rule: '@next/next/no-html-link-for-pages', page: null },
    });
    expect(explain(undefined, 'eslint/@next/next/no-html-link-for-pages')).toMatchObject({
        data: { tool: 'eslint', rule: '@next/next/no-html-link-for-pages', page: null },
    });
    expect(() => explain(undefined, 'typescript-eslint/no-explicit-any')).toThrow('typescript-eslint/no-explicit-any');
    expect(explain(undefined, 'eslint/typescript-eslint/no-explicit-any')).toMatchObject({ data: { page: null } });
});

test.each(['recommended', 'all'])('declared rule pages remain available in root and child at %s', async (level) => {
    await using sandbox = await testdir();
    const policy = `level = "${level}"\nconfigurations = ["python"]\n[scope.app]\nconfigurations = ["swift"]\n`;
    await createFileTree(sandbox.path, { 'gspot.toml': policy, 'app/sample.swift': 'let value = 1\n' });
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
    expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(policy);
});
