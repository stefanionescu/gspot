import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { runChecks } from '#cli/engine/run/checks.ts';
import { openSession } from '#cli/engine/session.ts';
import { IMPORT_RULE_TABLES } from '#tests/config/configurations/general.ts';
import { getBuiltInCheck, planSandboxCheck, runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll } from '#tests/setup/system/git.ts';

async function runWeakenings(root: string): Promise<{ rules: Array<string | undefined>; notes: string[] }> {
    const session = await openSession(root);
    const { report } = await runChecks(session, buildRunOptions({ only: ['gspot/weakenings'] }));
    return {
        rules: report.checks.flatMap(({ findings }) => findings.map(({ rule }) => rule)),
        notes: report.notes,
    };
}

async function listWeakeningRules(root: string): Promise<Array<string | undefined>> {
    const findings = await runSandboxCheck(root, 'gspot/weakenings');
    return findings.map(({ rule }) => rule);
}

async function writeFiles(root: string, files: Record<string, string>): Promise<void> {
    for (const [name, text] of Object.entries(files)) await writeFile(join(root, name), text);
}

test.each([
    {
        name: 'a lower level',
        base: buildSandboxSettings([], { level: 'all' }),
        head: buildSandboxSettings([], { level: 'basic' }),
        rules: ['level'],
    },
    {
        name: 'hooks turned off',
        base: buildSandboxSettings([], { tables: '[hooks]\nenabled = true\n' }),
        head: buildSandboxSettings([]),
        rules: ['hooks'],
    },
    {
        name: 'rule files turned off',
        base: buildSandboxSettings([], { rules: true }),
        head: buildSandboxSettings([]),
        rules: ['rule-files'],
    },
    {
        name: 'a configuration dropped from the list',
        base: buildSandboxSettings(['docs']),
        head: buildSandboxSettings([]),
        rules: ['configuration'],
    },
    {
        name: 'a limit raised with no reason',
        base: buildSandboxSettings([], { tables: '[limits]\nmax_file_lines = 100\n' }),
        head: buildSandboxSettings([], { tables: '[limits]\nmax_file_lines = 200\n' }),
        rules: ['setting'],
    },
])('gspot/weakenings reports $name', async ({ base, head, rules }) => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': base });
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'gspot.toml'), head);
    expect(await listWeakeningRules(sandbox.path)).toStrictEqual([...rules]);
});

test.each([
    {
        name: 'an import rule that gains a can_import entry at the head is a weakening',
        head: IMPORT_RULE_TABLES.replace('can_import = ["core"]', 'can_import = ["core", "store"]'),
        rules: ['import-rule'],
    },
    {
        name: 'an import rule that moves below another one may import it, which is a weakening',
        head: `${IMPORT_RULE_TABLES.slice(IMPORT_RULE_TABLES.indexOf('[[import_rule]]\nname = "store"'))}\n${IMPORT_RULE_TABLES.slice(0, IMPORT_RULE_TABLES.indexOf('[[import_rule]]\nname = "store"'))}`,
        rules: ['import-rule'],
    },
    {
        name: 'an import rule that gains a path at the head is a weakening',
        head: IMPORT_RULE_TABLES.replace('paths = ["src/app/**"]', 'paths = ["src/app/**", "scripts/**"]'),
        rules: ['import-rule'],
    },
    {
        name: 'an import rule removed at the head is a weakening',
        head: IMPORT_RULE_TABLES.slice(0, IMPORT_RULE_TABLES.indexOf('[[import_rule]]\nname = "app"')),
        rules: ['import-rule'],
    },
    {
        name: 'an import rule added at the head and unchanged rules are no weakening',
        head: `${IMPORT_RULE_TABLES}\n[[import_rule]]\nname = "main"\npaths = ["src/main.ts"]\n`,
        rules: [],
    },
])('$name', async ({ head, rules }) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: IMPORT_RULE_TABLES }),
    });
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'gspot.toml'), buildSandboxSettings([], { tables: head }));
    expect(await listWeakeningRules(sandbox.path)).toStrictEqual([...rules]);
});

test('an entry removed from javascript.import_boundaries is a weakening, and an added one is not', async () => {
    const base = '[javascript]\nimport_boundaries = ["src/features/*", "src/pages/*"]\n';
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], { tables: base }),
    });
    commitAll(sandbox.path);
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        buildSandboxSettings(['javascript'], { tables: base.replace('"src/pages/*"', '"src/widgets/*"') }),
    );
    const findings = await runSandboxCheck(sandbox.path, 'gspot/weakenings');
    expect(findings.map(({ rule, message }) => ({ rule, message }))).toStrictEqual([
        { rule: 'import-rule', message: expect.stringContaining('src/pages/*') as string },
    ]);
});

test('rule options that leave out a shipped key are a weakening', async () => {
    const options = '[tools.eslint.rules]\n"unicorn/consistent-boolean-name" = [{ checkFunctions = "never" }]\n';
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all' }),
    });
    commitAll(sandbox.path);
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        buildSandboxSettings(['javascript'], { level: 'all', tables: options }),
    );
    const findings = await runSandboxCheck(sandbox.path, 'gspot/weakenings');
    expect(findings.map(({ rule, message }) => ({ rule, message }))).toStrictEqual([
        { rule: 'rule-options', message: expect.stringContaining('prefixes') as string },
    ]);
});

test('rule options that change a shipped key are a weakening, and options that repeat every shipped key are not', async () => {
    const repeated =
        '[tools.eslint.rules]\n"n/no-unpublished-import" = [{ ignoreTypeImport = true, allowModules = ["bun"] }]\n';
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all' }),
    });
    commitAll(sandbox.path);
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        buildSandboxSettings(['javascript'], { level: 'all', tables: repeated }),
    );
    expect(await listWeakeningRules(sandbox.path)).toStrictEqual([]);
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        buildSandboxSettings(['javascript'], {
            level: 'all',
            tables: repeated.replace('ignoreTypeImport = true', 'ignoreTypeImport = false'),
        }),
    );
    expect(await listWeakeningRules(sandbox.path)).toStrictEqual(['rule-options']);
});

test.each([
    {
        name: 'an added ignore',
        head: buildSandboxSettings([], {
            tables: '[[ignore]]\ncheck = "docs/missing-paths"\npaths = ["a.md"]\nreason = "the path is an example"\n',
        }),
        reason: 'the path is an example',
    },
    {
        name: 'a removed configuration',
        head: buildSandboxSettings([], { tables: '[removed_configurations]\nbash = "no guide lives here"\n' }),
        reason: 'no guide lives here',
    },
    {
        name: 'a raised limit',
        head: buildSandboxSettings([], {
            tables: '[limits]\nmax_file_lines = { value = 500, reason = "the parser is generated" }\n',
        }),
        reason: 'the parser is generated',
    },
])('gspot/weakenings prints $name with its reason as a note', async ({ head, reason }) => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]), 'a.md': '# A\n' });
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'gspot.toml'), head);
    expect(await runWeakenings(sandbox.path)).toStrictEqual({
        rules: [],
        notes: [expect.stringContaining(reason) as string],
    });
});

test('gspot/weakenings reports only the path that widens an ignore', async () => {
    const tables = '[[ignore]]\ncheck = "docs/missing-paths"\npaths = ["a.md"]\nreason = "two words"\n';
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables }),
        'a.md': '# A\n',
        'b.md': '# B\n',
    });
    commitAll(sandbox.path);
    await writeFiles(sandbox.path, {
        'gspot.toml': buildSandboxSettings([], { tables: tables.replace('"a.md"', '"a.md", "b.md"') }),
    });
    const { notes } = await runWeakenings(sandbox.path);
    expect(notes).toStrictEqual(['An ignore of docs/missing-paths covers b.md: two words']);
});

test('gspot/weakenings keeps quiet about a scope whose folder went with it', async () => {
    const scope = [{ path: 'gone', configurations: ['docs'] }];
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { scopes: scope }),
        'gone/a.md': '# A\n',
    });
    commitAll(sandbox.path);
    await rm(join(sandbox.path, 'gone'), { recursive: true });
    await writeFile(join(sandbox.path, 'gspot.toml'), buildSandboxSettings([]));
    commitAll(sandbox.path, 'scope gone');
    expect(await runWeakenings(sandbox.path)).toStrictEqual({ rules: [], notes: [] });
});

test('gspot/weakenings reports a scope that goes while its folder stays', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { scopes: [{ path: 'kept', configurations: ['docs'] }] }),
        'kept/a.md': '# A\n',
    });
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'gspot.toml'), buildSandboxSettings([]));
    expect(await listWeakeningRules(sandbox.path)).toStrictEqual(['configuration']);
});

test('gspot/weakenings takes a reason through an ignore of the rule', async () => {
    const tables = '[[ignore]]\ncheck = "gspot/weakenings"\nrule = "level"\nreason = "the team chose basic"\n';
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([], { level: 'all' }) });
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'gspot.toml'), buildSandboxSettings([], { level: 'basic', tables }));
    expect(await runWeakenings(sandbox.path)).toStrictEqual({
        rules: [],
        notes: ['An ignore of gspot/weakenings level covers every path: the team chose basic'],
    });
});

test('gspot/weakenings compares with the base of the run, not the last commit', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([], { level: 'all' }) });
    const base = commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'gspot.toml'), buildSandboxSettings([], { level: 'basic' }));
    commitAll(sandbox.path, 'lower the level');
    const session = await openSession(sandbox.path);
    const check = getBuiltInCheck('gspot/weakenings', { content: 'working-tree', base });
    const findings = await check(session, planSandboxCheck(session, 'gspot/weakenings'));
    expect(findings.map(({ rule }) => rule)).toStrictEqual(['level']);
});

test('gspot/weakenings compares with the shipped defaults when gspot refuses the base gspot.toml', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': 'unknown_key = true\n' });
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'gspot.toml'), buildSandboxSettings([]));
    expect(await listWeakeningRules(sandbox.path)).toStrictEqual(['hooks', 'rule-files']);
});

test('a base file with an unknown key still compares its level and switches', async () => {
    const head = buildSandboxSettings([], { level: 'basic' });
    await using sandbox = await createGitSandbox({
        'gspot.toml': `unknown_key = true\n${buildSandboxSettings([], { level: 'all' })}`,
    });
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'gspot.toml'), head);
    expect(await runWeakenings(sandbox.path)).toStrictEqual({ rules: ['level'], notes: [] });
});

test('a rule file excluded at the head is a weakening', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([], { rules: true }) });
    commitAll(sandbox.path);
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        buildSandboxSettings([], { rules: true, tables: '[rule_files]\nexclude = [".gspot/rules/TESTING.md"]\n' }),
    );
    expect(await listWeakeningRules(sandbox.path)).toStrictEqual(['rule-files']);
});

test('a scope limit raised without a reason is reported with its scope', async () => {
    const base = buildSandboxSettings([], {
        tables: '[[scope]]\npath = "app"\n[scope.limits]\nmax_file_lines = 100\n',
    });
    await using sandbox = await createGitSandbox({ 'gspot.toml': base, 'app/a.md': '# A\n' });
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'gspot.toml'), base.replace('= 100', '= 200'));
    const findings = await runSandboxCheck(sandbox.path, 'gspot/weakenings');
    expect(findings.map(({ rule, message }) => ({ rule, message }))).toStrictEqual([
        { rule: 'setting', message: expect.stringContaining('app') as string },
    ]);
});
