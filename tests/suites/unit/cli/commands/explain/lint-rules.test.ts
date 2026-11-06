import { existsSync } from 'node:fs';
import { readFile, symlink } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { executableLayout } from '#cli/system/paths.ts';
import { findValueAt, isTable } from '#cli/system/tables.ts';
import plugin from '#eslint-plugin/plugin.ts';
import { RULE_PAGE_SETTINGS, RULE_PAGES, UNKNOWN_RULES } from '#tests/config/commands/reports.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { getShippedCheck } from '#tests/setup/cli/manifests.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { toolModules } from '#tests/setup/sandboxes/node-modules.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakeCommands } from '#tests/setup/system/fakes.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

async function readToolRules(name: string, specifier: string): Promise<Record<string, unknown>> {
    if (name === '@gspothq/eslint-plugin') return plugin.rules;
    const require = createRequire(join(toolModules, 'package.json'));
    const installed: unknown = await import(pathToFileURL(require.resolve(specifier)).href);
    const builtin: unknown = findValueAt(installed, ['builtinRules']);
    if (builtin instanceof Map) return Object.fromEntries(builtin) as Record<string, unknown>;
    const exported = findValueAt(installed, ['default']) ?? installed;
    const rules: unknown = Reflect.get(new Object(exported), 'rules') ?? findValueAt(exported, ['plugin', 'rules']);
    if (!isTable(rules)) throw new Error(`No rules in ${name}.`);
    return rules;
}

async function writeRulePackages(root: string): Promise<void> {
    for (const [name, specifier] of [
        ['eslint', 'eslint/use-at-your-own-risk'],
        ['eslint-plugin-n', 'eslint-plugin-n'],
        ['typescript-eslint', 'typescript-eslint'],
        ['stylelint', 'stylelint'],
        ['@gspothq/eslint-plugin', '@gspothq/eslint-plugin'],
    ] as const) {
        const rules = await readToolRules(name, specifier);
        const metadata: Record<string, unknown> = {};
        for (const [key, rule] of Object.entries(rules)) {
            const ruleMetadata: unknown = Reflect.get(new Object(await rule), 'meta');
            metadata[key] = { meta: ruleMetadata };
        }
        let body: string;
        if (name === 'eslint') body = `exports.builtinRules = new Map(Object.entries(${JSON.stringify(metadata)}));`;
        else if (name === 'typescript-eslint')
            body = `module.exports = ${JSON.stringify({ plugin: { rules: metadata } })};`;
        else body = `module.exports = ${JSON.stringify({ rules: metadata })};`;
        await createFileTree(root, {
            [`.gspot/node_modules/${name}/package.json`]: JSON.stringify({
                name,
                exports: { '.': './index.cjs', './use-at-your-own-risk': './index.cjs' },
            }),
            [`.gspot/node_modules/${name}/index.cjs`]: body,
        });
    }
}

test('explain reads installed rule metadata without executing generated configuration', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript', 'typescript', 'css']),
        'source.ts': 'export const value = 1;\n',
        '.gspot/configurations/javascript/eslint/eslint.mjs': 'throw new Error("Generated config executed");',
    });
    await writeRulePackages(sandbox.path);
    for (const [check, rule, page] of RULE_PAGES) {
        const result = await runGspot(sandbox.path, ['explain', check, rule, '--json']);
        expect(result.code, result.stderr).toBe(0);
        expect(JSON.parse(result.stdout)).toMatchObject({ kind: 'lint-rule', check, rule, page });
    }
    const described = await runGspot(sandbox.path, ['explain', 'javascript/eslint', 'gspot/no-trivial-functions']);
    for (const label of ['Why:', 'What to do:', 'Example:']) {
        expect(described.stdout).toContain(label);
        expect(described.stdout.indexOf(label)).toBeLessThan(described.stdout.indexOf('Ignore it'));
    }
    expect(described.stdout).toContain('Ignore it only with a reason your team accepts.');
    for (const [check, rule] of UNKNOWN_RULES) {
        const refused = await runGspot(sandbox.path, ['explain', check, rule, '--json']);
        expect(refused.code).toBe(2);
        expect(JSON.parse(refused.stdout)).toMatchObject({
            error: 'arguments',
            message: expect.stringContaining(rule) as string,
        });
    }
});

test('explain offers the setting that writes the options of a rule, and the rules table for the others', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript']),
        'source.js': 'export const value = 1;\n',
    });
    await writeRulePackages(sandbox.path);
    for (const [rule, changeOptions] of [
        ['gspot/no-trivial-files', 'gspot set structure.reexports <value>'],
        ['max-params', 'gspot set limits.max_function_parameters <value>'],
        ['no-param-reassign', `gspot set tools.eslint.rules '{ "no-param-reassign" = [<options>] }'`],
    ] as const) {
        const result = await runGspot(sandbox.path, ['explain', 'javascript/eslint', rule, '--json']);
        expect(result.code, result.stderr).toBe(0);
        expect(JSON.parse(result.stdout)).toMatchObject({ rule, changeOptions });
    }
});

test.each([
    { check: 'javascript/eslint', rule: 'import-lite/no-default-export' },
    { check: 'css/stylelint', rule: 'CssSyntaxError' },
    { check: 'prose/vale', rule: 'Vale.Repetition' },
    { check: 'javascript/biome', rule: 'parse' },
    { check: 'commits/commitlint', rule: 'subject-case' },
])('explain and ignore take $rule, which a report of $check prints', async ({ check, rule }) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript', 'css', 'prose', 'markdown']),
        'source.js': 'export const value = 1;\n',
        'theme.css': 'a { color: #fff; }\n',
        'guide.md': '# Guide\n',
    });
    await writeRulePackages(sandbox.path);
    const explained = await runGspot(sandbox.path, ['explain', check, rule, '--json']);
    expect(explained.code, explained.stdout + explained.stderr).toBe(0);
    expect(JSON.parse(explained.stdout)).toMatchObject({
        check,
        rule,
        fix: getShippedCheck(check).help,
        changeOptions: null,
    });
    const ignored = await runGspot(sandbox.path, [
        'ignore',
        check,
        '--rule',
        rule,
        '--reason',
        'The team reads this one by hand.',
    ]);
    expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
});

test.each([
    {
        summary: 'Add `from __future__ import annotations` to simplify `{name}`',
        description: 'Add `from __future__ import annotations` to simplify `<name>`',
    },
    { summary: 'Unused {}', description: 'Unused <value>' },
    { summary: 'Expected {count:?} blank lines', description: 'Expected <count> blank lines' },
])('explain writes the fields of the Ruff summary "$summary" as placeholders', async ({ summary, description }) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python']),
        [`.gspot/.venv/${executableLayout.environmentFolder}/ruff${isWindows ? '.exe' : ''}`]: '',
    });
    using _commands = fakeCommands().mockResolvedValue(
        buildProcessResult({ stdout: JSON.stringify({ name: 'a-rule', summary, explanation: '' }) }),
    );
    const result = await runGspot(sandbox.path, ['explain', 'python/ruff', 'FA100', '--json']);
    expect(result.code, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ description, changeOptions: null });
});

test('explain gives Ruff summaries and reserves its full explanation for verbose output', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': RULE_PAGE_SETTINGS,
        'app/source.swift': 'let count = 1\n',
        [`.gspot/.venv/${executableLayout.environmentFolder}/ruff${isWindows ? '.exe' : ''}`]: '',
    });
    using commands = fakeCommands().mockResolvedValue(
        buildProcessResult({
            stdout: JSON.stringify({
                name: 'unused-import',
                summary: 'Unused import',
                explanation: 'Delete the import that no expression reads.',
            }),
        }),
    );
    const root = await runGspot(sandbox.path, ['explain', 'python/ruff', 'F401', '--json']);
    expect(root.code, root.stderr).toBe(0);
    expect(JSON.parse(root.stdout)).toMatchObject({ description: 'Unused import', rule: 'F401', explanation: null });
    const child = await runGspot(join(sandbox.path, 'app'), ['explain', 'python/ruff', 'F401', '--verbose']);
    expect(child.code, child.stderr).toBe(0);
    expect(child.stdout).toContain('Delete the import that no expression reads.');
    expect(
        commands.mock.calls.every(([command]) => command.slice(1).join(' ') === 'rule F401 --output-format json'),
    ).toBe(true);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(RULE_PAGE_SETTINGS);
});

test('explain prints the check help when Ruff stops before it answers', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python']),
        [`.gspot/.venv/${executableLayout.environmentFolder}/ruff${isWindows ? '.exe' : ''}`]: '',
    });
    using _commands = fakeCommands().mockResolvedValue(buildProcessResult({ end: 'failed', signal: 'SIGABRT' }));
    const result = await runGspot(sandbox.path, ['explain', 'python/ruff', 'F401', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ rule: 'F401', fix: getShippedCheck('python/ruff').help });
});

test.each(['javascript/eslint', 'css/stylelint'])('explain refuses ancestor packages for %s', async (check) => {
    const name = check === 'javascript/eslint' ? 'eslint' : 'stylelint';
    await using sandbox = await createGitSandbox({
        [`node_modules/${name}/package.json`]: JSON.stringify({
            name,
            exports: check === 'javascript/eslint' ? { './use-at-your-own-risk': './index.cjs' } : './index.cjs',
        }),
        [`node_modules/${name}/index.cjs`]: 'require("node:fs").writeFileSync(__dirname + "/executed", "yes");',
    });
    const result = await runGspot(sandbox.path, ['explain', check, 'no-var', '--json']);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
        error: 'tool',
        message: expect.stringContaining('.gspot/node_modules') as string,
    });
    expect(existsSync(join(sandbox.path, `node_modules/${name}/executed`))).toBe(false);
});

test.skipIf(isWindows)('explain refuses an installed plugin symlink that leaves the tool project', async () => {
    await using sandbox = await createGitSandbox({
        'outside/package.json': '{"name":"eslint-plugin-n","main":"index.cjs"}',
        'outside/index.cjs': 'throw new Error("External plugin executed");',
        '.gspot/node_modules/.keep': '',
    });
    await symlink(join(sandbox.path, 'outside'), join(sandbox.path, '.gspot/node_modules/eslint-plugin-n'));
    const result = await runGspot(sandbox.path, ['explain', 'javascript/eslint', 'n/prefer-global/process', '--json']);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
        error: 'tool',
        message: expect.stringContaining('.gspot/node_modules') as string,
    });
});

test('explain requires installed tools and refuses rules of checks with no rule explanations', async () => {
    await using sandbox = await createGitSandbox({});
    const missing = await runGspot(sandbox.path, ['explain', 'javascript/eslint', 'no-var', '--json']);
    expect(missing.code).toBe(2);
    expect(JSON.parse(missing.stdout)).toMatchObject({ error: 'tool' });
    const unknown = await runGspot(sandbox.path, ['explain', 'bash/shfmt', 'unknown', '--json']);
    expect(unknown.code).toBe(2);
    expect(JSON.parse(unknown.stdout)).toMatchObject({
        error: 'arguments',
        message: expect.stringContaining('bash/shfmt') as string,
    });
});
