import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { readFile } from 'node:fs/promises';
import { SWIFT_VALUE_SOURCE } from '#tests/config/swift.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { runGspot, runGspotStep } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { linkInstalledModules } from '#tests/setup/sandboxes/node-modules.ts';

import {
    RULE_PAGES,
    UNKNOWN_RULES,
    ROOT_RULE_PAGE,
    CHILD_RULE_PAGE,
    RULE_PAGE_SETTINGS,
    SHELLCHECK_RULE_PAGE,
} from '#tests/config/commands/explain/lint-rules.ts';

test('explain shellcheck/SC2086 gives the rule page and the gspot ignore commands', async () => {
    await using sandbox = await createGitSandbox({});
    const shellcheck = await runGspot(sandbox.path, ['explain', 'shellcheck/SC2086', '--json']);
    const shellcheckText = await runGspot(sandbox.path, ['explain', 'shellcheck/SC2086']);
    expect(JSON.parse(shellcheck.stdout)).toMatchObject(SHELLCHECK_RULE_PAGE);
    expect(shellcheckText.stdout).toBe(
        'shellcheck/SC2086  (run by bash/shellcheck)\n\nThe tool\'s page: https://www.shellcheck.net/wiki/SC2086\n\nTurn it off everywhere: gspot ignore bash/shellcheck --rule SC2086 --reason "<why>"\nTurn it off for some paths: gspot ignore bash/shellcheck --rule SC2086 --paths "<glob>" --reason "<why>"\n',
    );
});

test('explain gives a TypeScript error the gspot ignore commands, and no rule options or page', async () => {
    await using sandbox = await createGitSandbox({});
    const rule = await runGspot(sandbox.path, ['explain', 'tsc/TS2345', '--json']);
    const ruleText = await runGspot(sandbox.path, ['explain', 'tsc/TS2345']);
    expect(JSON.parse(rule.stdout)).toMatchObject({ kind: 'lint-rule', tool: 'tsc', rule: 'TS2345', page: null });
    expect(ruleText.stdout).toBe(
        'tsc/TS2345  (run by javascript/tsc)\n\nRead the tsc documentation for TS2345.\n\nTurn it off everywhere: gspot ignore javascript/tsc --rule TS2345 --reason "<why>"\nTurn it off for some paths: gspot ignore javascript/tsc --rule TS2345 --paths "<glob>" --reason "<why>"\n',
    );
});

test('explain finds rule pages from the root and from a child scope', async () => {
    await using sandbox = await createGitSandbox({});
    await createFileTree(sandbox.path, { 'gspot.toml': RULE_PAGE_SETTINGS, 'app/sample.swift': SWIFT_VALUE_SOURCE });
    const root = await runGspot(sandbox.path, ['explain', 'ruff/F401', '--json']);
    expect(root.code, root.stdout + root.stderr).toBe(0);
    expect(JSON.parse(root.stdout)).toMatchObject(ROOT_RULE_PAGE);
    const child = await runGspot(join(sandbox.path, 'app'), ['explain', 'swiftlint/type_body_length', '--json']);
    expect(child.code, child.stdout + child.stderr).toBe(0);
    expect(JSON.parse(child.stdout)).toMatchObject(CHILD_RULE_PAGE);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(RULE_PAGE_SETTINGS);
});

test('explain reads ESLint, plugin, and Stylelint rules from the installed tools', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript', 'typescript', 'css']),
        'package.json': '{"private":true,"type":"module"}',
        'source.ts': 'export const value = 1;\n',
        'style.css': 'a { color: red; }\n',
    });
    await linkInstalledModules(join(sandbox.path, 'node_modules'));
    await runGspotStep({ root: sandbox.path, run: runGspot }, ['apply']);
    for (const [subject, page] of RULE_PAGES) {
        const explained = await runGspot(sandbox.path, ['explain', subject, '--json']);
        expect(explained.code, subject + explained.stderr).toBe(0);
        expect(JSON.parse(explained.stdout), subject).toMatchObject({ kind: 'lint-rule', page });
    }
    const described = await runGspot(sandbox.path, ['explain', 'eslint/no-var']);
    expect(described.stdout.split('\n').slice(0, 4)).toStrictEqual([
        'eslint/no-var  (run by javascript/eslint)',
        '',
        'What it looks for: Require `let` or `const` instead of `var`',
        "The tool's page: https://eslint.org/docs/latest/rules/no-var",
    ]);
    for (const subject of UNKNOWN_RULES) {
        const refused = await runGspot(sandbox.path, ['explain', subject]);
        expect(refused.code, subject).toBe(2);
        expect(refused.stderr, subject).toStartWith(`gspot cannot explain ${subject}. Give a check (python/ruff),`);
    }
});

test('explain of an ESLint rule asks for gspot install when the tools are not installed', async () => {
    await using sandbox = await createGitSandbox({});
    const missing = await runGspot(sandbox.path, ['explain', 'eslint/no-var']);
    expect(missing.code).toBe(2);
    expect(missing.stderr).toBe(
        'gspot explain reads lint rules from the tools that gspot install puts in .gspot/node_modules. Run gspot install.\n',
    );
});
