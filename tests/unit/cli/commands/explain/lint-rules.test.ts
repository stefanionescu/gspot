import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/cli/commands.ts';

import {
    RULE_PAGES,
    ROOT_RULE_PAGE,
    CHILD_RULE_PAGE,
    RULE_PAGE_SETTINGS,
    UNKNOWN_RULE_PREFIX,
    NPM_SCOPE_RULE_PAGE,
    SHELLCHECK_RULE_PAGE,
} from '#tests/data/commands/explain/lint-rules.ts';

test('explain shellcheck/SC2086 gives the rule page and the gspot ignore commands', async () => {
    await using sandbox = await testdir();
    const shellcheck = await runGspot(sandbox.path, ['explain', 'shellcheck/SC2086', '--json']);
    const shellcheckText = await runGspot(sandbox.path, ['explain', 'shellcheck/SC2086']);
    expect(JSON.parse(shellcheck.stdout)).toMatchObject(SHELLCHECK_RULE_PAGE);
    expect(shellcheckText.stdout).toBe(
        'shellcheck/SC2086  (run by bash/shellcheck)\n\nThe tool\'s page: https://www.shellcheck.net/wiki/SC2086\n\nTurn it off everywhere: gspot ignore bash/shellcheck --rule SC2086 --reason "<why>"\nTurn it off for some paths: gspot ignore bash/shellcheck --rule SC2086 --paths "<glob>" --reason "<why>"\n',
    );
});

test.each([...RULE_PAGES])(
    'a plugin rule, with or without the eslint/ prefix, finds the page of its plugin: %s',
    async (subject, page) => {
        await using sandbox = await testdir();
        const subjectExplanation = await runGspot(sandbox.path, ['explain', subject, '--json']);
        expect(JSON.parse(subjectExplanation.stdout)).toMatchObject({
            kind: 'lint-rule',
            tool: 'eslint',
            page,
        });
    },
);
test('explain refuses an unknown rule prefix and names the subjects it explains', async () => {
    await using sandbox = await testdir();
    const refusal = await runGspot(sandbox.path, ['explain', 'unknown/no-such-rule']);
    expect(refusal.code).toBe(2);
    expect(refusal.stderr).toBe(
        'gspot cannot explain unknown/no-such-rule. Give a check (python/ruff), a lint rule (eslint/no-console), a configuration (python), a setting (limits.file_lines), or a file (./src/app.ts).\n',
    );
});

test('explain gives an unknown plugin rule after eslint/ the ESLint commands and no page', async () => {
    await using sandbox = await testdir();
    const unknownEslintRule = await runGspot(sandbox.path, ['explain', 'eslint/unknown/no-such-rule', '--json']);
    expect(JSON.parse(unknownEslintRule.stdout)).toMatchObject(UNKNOWN_RULE_PREFIX);
});

test('explain gives a TypeScript error the gspot ignore commands, and no rule options or page', async () => {
    await using sandbox = await testdir();
    const rule = await runGspot(sandbox.path, ['explain', 'tsc/TS2345', '--json']);
    const ruleText = await runGspot(sandbox.path, ['explain', 'tsc/TS2345']);
    expect(JSON.parse(rule.stdout)).toMatchObject({ kind: 'lint-rule', tool: 'tsc', rule: 'TS2345', page: null });
    expect(ruleText.stdout).toBe(
        'tsc/TS2345  (run by javascript/tsc)\n\nRead the tsc documentation for TS2345.\n\nTurn it off everywhere: gspot ignore javascript/tsc --rule TS2345 --reason "<why>"\nTurn it off for some paths: gspot ignore javascript/tsc --rule TS2345 --paths "<glob>" --reason "<why>"\n',
    );
});

test('a plugin prefix with an npm scope must match a plugin that a manifest declares', async () => {
    await using sandbox = await testdir();
    const nextLink = await runGspot(sandbox.path, ['explain', '@next/next/no-html-link-for-pages', '--json']);
    expect(JSON.parse(nextLink.stdout)).toMatchObject(NPM_SCOPE_RULE_PAGE);
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
    expect(refusal.stderr).toBe(
        'gspot cannot explain typescript-eslint/no-explicit-any. Give a check (python/ruff), a lint rule (eslint/no-console), a configuration (python), a setting (limits.file_lines), or a file (./src/app.ts). Did you mean `typescript`?\n',
    );
    const unknownTypescriptPrefix = await runGspot(sandbox.path, [
        'explain',
        'eslint/typescript-eslint/no-explicit-any',
        '--json',
    ]);
    expect(JSON.parse(unknownTypescriptPrefix.stdout)).toMatchObject({ page: null });
});

test('explain finds rule pages from the root and from a child scope', async () => {
    await using sandbox = await testdir();
    const settings = RULE_PAGE_SETTINGS;
    await createFileTree(sandbox.path, { 'gspot.toml': settings, 'app/sample.swift': 'let value = 1\n' });
    const root = await runGspot(sandbox.path, ['explain', 'ruff/F401', '--json']);
    expect(root.code, root.stdout + root.stderr).toBe(0);
    expect(JSON.parse(root.stdout)).toMatchObject(ROOT_RULE_PAGE);
    const child = await runGspot(join(sandbox.path, 'app'), ['explain', 'swiftlint/type_body_length', '--json']);
    expect(child.code, child.stdout + child.stderr).toBe(0);
    expect(JSON.parse(child.stdout)).toMatchObject(CHILD_RULE_PAGE);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
});
