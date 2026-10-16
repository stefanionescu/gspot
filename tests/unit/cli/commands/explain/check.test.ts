import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { explain } from '#cli/commands/explain/command.ts';
import { createReadCache } from '#cli/system/files/cache.ts';

test('a rule is explained with the page its manifest declares', () => {
    const shellcheck = explain(undefined, 'shellcheck/SC2086', createReadCache(process.cwd()));
    expect(shellcheck).toMatchObject({
        kind: 'lint-rule',
        data: { tool: 'shellcheck', rule: 'SC2086', page: 'https://www.shellcheck.net/wiki/SC2086' },
    });
    expect(shellcheck.text).toContain('gspot ignore bash/shellcheck --rule SC2086');
    expect(shellcheck.text).not.toContain('tools.shellcheck.rules');
    expect(explain(undefined, 'no-undef', createReadCache(process.cwd()))).toMatchObject({
        kind: 'lint-rule',
        subject: 'eslint/no-undef',
        data: { page: 'https://eslint.org/docs/latest/rules/no-undef' },
    });
    expect(explain(undefined, 'no-var', createReadCache(process.cwd()))).toMatchObject({
        kind: 'lint-rule',
        subject: 'eslint/no-var',
        data: { page: 'https://eslint.org/docs/latest/rules/no-var' },
    });
    expect(explain(undefined, 'eslint/no-var', createReadCache(process.cwd()))).toMatchObject({
        data: { page: 'https://eslint.org/docs/latest/rules/no-var' },
    });
});

test('a plugin rule is explained with the page of the plugin its prefix names', () => {
    expect(explain(undefined, 'eslint/unicorn/prefer-set-has', createReadCache(process.cwd()))).toMatchObject({
        data: { page: 'https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-set-has.md' },
    });
    expect(
        explain(undefined, 'eslint/@typescript-eslint/no-explicit-any', createReadCache(process.cwd())),
    ).toMatchObject({
        data: { page: 'https://typescript-eslint.io/rules/no-explicit-any' },
    });
    expect(explain(undefined, 'eslint/sonarjs/no-identical-functions', createReadCache(process.cwd()))).toMatchObject({
        data: { page: null },
    });
});

test.each([
    ['gspot/no-trivial-functions', 'https://generativespotting.com/reference/eslint-plugin/no-trivial-functions/'],
    ['@typescript-eslint/no-explicit-any', 'https://typescript-eslint.io/rules/no-explicit-any'],
    [
        'unicorn/prefer-set-has',
        'https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-set-has.md',
    ],
])('a plugin rule without the eslint/ prefix finds its page: %s', (subject, page) => {
    expect(explain(undefined, subject, createReadCache(process.cwd()))).toMatchObject({
        kind: 'lint-rule',
        data: { tool: 'eslint', page },
    });
});

test('a check explains the minimum version its declaring tool needs', () => {
    const ruff = explain(undefined, 'python/ruff', createReadCache(process.cwd()));
    expect(ruff.text).toContain('Needs ruff 0.9.0 or newer');
});

test('an unknown rule prefix is refused and names the subject', () => {
    expect(() => explain(undefined, 'unknown/no-such-rule', createReadCache(process.cwd()))).toThrow(
        'There is no check called `unknown/no-such-rule`',
    );
    expect(explain(undefined, 'eslint/unknown/no-such-rule', createReadCache(process.cwd()))).toMatchObject({
        kind: 'lint-rule',
        data: { tool: 'eslint', rule: 'unknown/no-such-rule', page: null },
    });
});

test('TypeScript errors have no rule options and no page link', () => {
    const rule = explain(undefined, 'tsc/TS2345', createReadCache(process.cwd()));
    expect(rule).toMatchObject({ kind: 'lint-rule', data: { tool: 'tsc', rule: 'TS2345', page: null } });
    expect(rule.text).toContain('Read the tsc documentation for TS2345.');
    expect(rule.text).not.toContain('Change its options:');
    expect(rule.text).not.toContain('tools.tsc.rules');
    expect(rule.text).not.toContain("The tool's page:");
    expect(explain(undefined, 'javascript/tsc', createReadCache(process.cwd()))).toMatchObject({
        data: { help: 'Add or fix the JSDoc type that the error names.' },
    });
});

test('a plugin prefix with an npm scope must match a manifest declaration', () => {
    expect(explain(undefined, '@next/next/no-html-link-for-pages', createReadCache(process.cwd()))).toMatchObject({
        subject: 'eslint/@next/next/no-html-link-for-pages',
        data: { tool: 'eslint', rule: '@next/next/no-html-link-for-pages', page: null },
    });
    expect(
        explain(undefined, 'eslint/@next/next/no-html-link-for-pages', createReadCache(process.cwd())),
    ).toMatchObject({
        data: { tool: 'eslint', rule: '@next/next/no-html-link-for-pages', page: null },
    });
    expect(() => explain(undefined, 'typescript-eslint/no-explicit-any', createReadCache(process.cwd()))).toThrow(
        'typescript-eslint/no-explicit-any',
    );
    expect(
        explain(undefined, 'eslint/typescript-eslint/no-explicit-any', createReadCache(process.cwd())),
    ).toMatchObject({ data: { page: null } });
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
