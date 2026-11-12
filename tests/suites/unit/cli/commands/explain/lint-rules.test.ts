import { existsSync } from 'node:fs';
import { symlink } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { stringify } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { executableLayout } from '#cli/system/paths.ts';
import { findValueAt, isTable } from '#cli/system/tables.ts';
import plugin from '#eslint-plugin/plugin.ts';
import { RULE_PAGE_SETTINGS, RULE_PAGES, UNKNOWN_RULES } from '#tests/config/commands/reports.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { getShippedCheck } from '#tests/setup/cli/manifests.ts';
import { buildReportingCheck, buildSandboxSettings } from '#tests/setup/cli/settings.ts';
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
    }
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

test('explain names the runtime record for no-undef, and no fix for a rule that no setting serves', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript']),
        'source.js': 'export const value = 1;\n',
    });
    await writeRulePackages(sandbox.path);
    const explained = await runGspot(sandbox.path, ['explain', 'javascript/eslint', 'no-undef']);
    expect(explained.code, explained.stdout + explained.stderr).toBe(0);
    expect(explained.stdout).toContain('What to do: ');
    expect(explained.stdout).toContain('[[tools.eslint.override]]');
    expect(explained.stdout).toContain('runtime = "browser"');
    const other = await runGspot(sandbox.path, ['explain', 'javascript/eslint', 'no-param-reassign', '--json']);
    expect(JSON.parse(other.stdout)).toMatchObject({ rule: 'no-param-reassign', fix: null });
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

test('explain reads a rule of a plugin that exports only an import entry', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript', 'astro']),
        'source.js': 'export const value = 1;\n',
        '.gspot/node_modules/eslint-plugin-astro/package.json':
            '{"type":"module","exports":{".":{"types":"./index.d.mts","import":"./index.mjs"}}}',
        '.gspot/node_modules/eslint-plugin-astro/index.mjs':
            'export default { rules: { "no-set-html-directive": { meta: { docs: { description: "Disallow set:html." } } } } };\n',
    });
    const result = await runGspot(sandbox.path, ['explain', 'javascript/eslint', 'astro/no-set-html-directive']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain('Disallow set:html.');
});

test('explain refuses ancestor packages for javascript/eslint', async () => {
    await using sandbox = await createGitSandbox({
        'node_modules/eslint/package.json': JSON.stringify({
            name: 'eslint',
            exports: { './use-at-your-own-risk': './index.cjs' },
        }),
        'node_modules/eslint/index.cjs': 'require("node:fs").writeFileSync(__dirname + "/executed", "yes");',
    });
    const result = await runGspot(sandbox.path, ['explain', 'javascript/eslint', 'no-var', '--json']);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
        error: 'tool',
        message: expect.stringContaining('.gspot/node_modules') as string,
    });
    expect(existsSync(join(sandbox.path, 'node_modules/eslint/executed'))).toBe(false);
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

test('explain css/stylelint names gspot add when no scope selects css, and only the install once one does', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['markdown']), 'style.css': '' });
    const unselected = await runGspot(sandbox.path, ['explain', 'css/stylelint', 'color-no-invalid-hex']);
    expect(unselected.code).toBe(2);
    expect(unselected.stderr).toContain('css is not selected. Run gspot add css, then gspot install.');
    await createFileTree(sandbox.path, { 'gspot.toml': buildSandboxSettings(['css']) });
    const selected = await runGspot(sandbox.path, ['explain', 'css/stylelint', 'color-no-invalid-hex']);
    expect(selected.code).toBe(2);
    expect(selected.stderr).toContain('Run gspot install.');
    expect(selected.stderr).not.toContain('gspot add');
});

test('explain refuses a rule of a check that names no rules', async () => {
    await using sandbox = await createGitSandbox({});
    const result = await runGspot(sandbox.path, ['explain', 'bash/shfmt', 'unknown', '--json']);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
        error: 'arguments',
        message: 'gspot cannot explain one lint rule of bash/shfmt. Leave out the rule to explain the whole check.',
    });
});

test('explain of a command check rule prints its help and the ignore command', async () => {
    const check = buildReportingCheck({ id: 'project/lint', paths: ['*'], stage: 'commit' });
    await using sandbox = await createGitSandbox({
        'gspot.toml': stringify({
            configurations: [],
            command_check: [
                { ...check, output: { format: 'regex', pattern: String.raw`(?<rule>R\d+) (?<message>.+)` } },
            ],
        }),
    });
    const result = await runGspot(sandbox.path, ['explain', 'project/lint', 'R1', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
        kind: 'lint-rule',
        check: 'project/lint',
        rule: 'R1',
        fix: expect.any(String) as string,
        turnOff: { everywhere: expect.stringContaining('gspot ignore project/lint --rule R1') as string },
    });
});
