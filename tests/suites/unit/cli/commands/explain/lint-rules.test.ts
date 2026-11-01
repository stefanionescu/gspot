import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { pathToFileURL } from 'node:url';
import { createFileTree } from 'testdirs';
import { createRequire } from 'node:module';
import plugin from '#eslint-plugin/plugin.ts';
import { symlink, readFile } from 'node:fs/promises';
import { executableLayout } from '#cli/system/paths.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { fakeCommands } from '#tests/setup/system/fakes.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { isTable, findValueAt } from '#cli/system/tables.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { toolModules } from '#tests/setup/sandboxes/node-modules.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { RULE_PAGES, UNKNOWN_RULES, RULE_PAGE_SETTINGS } from '#tests/config/commands/explain.ts';

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
        '.gspot/configurations/language/javascript/eslint/eslint.mjs': 'throw new Error("Generated config executed");',
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
        expect(described.stdout.indexOf(label)).toBeLessThan(described.stdout.indexOf('Turn it off'));
    }
    expect(described.stdout).toContain('Ask the user before you turn a rule off (SUPPRESSIONS.md).');
    for (const [check, rule] of UNKNOWN_RULES) {
        const refused = await runGspot(sandbox.path, ['explain', check, rule]);
        expect(refused.code).toBe(2);
        expect(refused.stderr).toBe(`gspot does not know rule ${rule} of ${check}.\n`);
    }
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
    expect(JSON.parse(root.stdout)).toMatchObject({ description: 'Unused import', rule: 'F401' });
    expect(JSON.parse(root.stdout)).not.toHaveProperty('explanation');
    const child = await runGspot(join(sandbox.path, 'app'), ['explain', 'python/ruff', 'F401', '--verbose']);
    expect(child.code, child.stderr).toBe(0);
    expect(child.stdout).toContain('Delete the import that no expression reads.');
    expect(
        commands.mock.calls.every(([command]) => command.slice(1).join(' ') === 'rule F401 --output-format json'),
    ).toBe(true);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(RULE_PAGE_SETTINGS);
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
    const result = await runGspot(sandbox.path, ['explain', check, 'no-var']);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain('resolves outside .gspot/node_modules');
    expect(existsSync(join(sandbox.path, `node_modules/${name}/executed`))).toBe(false);
});

test.skipIf(isWindows)('explain refuses an installed plugin symlink that leaves the tool project', async () => {
    await using sandbox = await createGitSandbox({
        'outside/package.json': '{"name":"eslint-plugin-n","main":"index.cjs"}',
        'outside/index.cjs': 'throw new Error("External plugin executed");',
        '.gspot/node_modules/.keep': '',
    });
    await symlink(join(sandbox.path, 'outside'), join(sandbox.path, '.gspot/node_modules/eslint-plugin-n'));
    const result = await runGspot(sandbox.path, ['explain', 'javascript/eslint', 'n/prefer-global/process']);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain('resolves outside .gspot/node_modules');
});

test('explain requires installed tools and refuses rules of checks with no rule documentation', async () => {
    await using sandbox = await createGitSandbox({});
    const missing = await runGspot(sandbox.path, ['explain', 'javascript/eslint', 'no-var']);
    expect(missing.code).toBe(2);
    expect(missing.stderr).toContain('Run gspot install.');
    const unknown = await runGspot(sandbox.path, ['explain', 'bash/shfmt', 'unknown']);
    expect(unknown.code).toBe(2);
    expect(unknown.stderr).toBe('gspot does not know rule unknown of bash/shfmt.\n');
});
