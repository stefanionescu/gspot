import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { runChecks } from '#cli/engine/run.ts';
import { rm, writeFile } from 'node:fs/promises';
import { openSession } from '#cli/engine/session.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

async function runWeakenings(root: string): Promise<{ rules: (string | undefined)[]; notes: string[] }> {
    const session = await openSession(root);
    const { report } = await runChecks(session, buildRunOptions({ only: ['gspot/weakenings'] }));
    return {
        rules: report.checks.flatMap(({ findings }) => findings.map(({ rule }) => rule)),
        notes: report.notes,
    };
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
    const { rules: found } = await runWeakenings(sandbox.path);
    expect(found).toStrictEqual(rules);
});

test.each([
    {
        name: 'an added ignore',
        head: buildSandboxSettings([], {
            tables: '[[ignore]]\ncheck = "docs/missing-paths"\npaths = ["a.md"]\nreason = "the path is an example"\n',
        }),
        note: 'An ignore of docs/missing-paths covers a.md: the path is an example',
    },
    {
        name: 'a removed configuration',
        head: buildSandboxSettings([], { tables: '[removed_configurations]\ndocs = "no guide lives here"\n' }),
        note: 'The configuration docs goes: no guide lives here',
    },
    {
        name: 'a raised limit',
        head: buildSandboxSettings([], {
            tables: '[limits]\nmax_file_lines = { value = 500, reason = "the parser is generated" }\n',
        }),
        note: 'limits.max_file_lines moves from 300 to 500: the parser is generated',
    },
])('gspot/weakenings prints $name with its reason as a note', async ({ head, note }) => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]), 'a.md': '# A\n' });
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'gspot.toml'), head);
    expect(await runWeakenings(sandbox.path)).toStrictEqual({ rules: [], notes: [note] });
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
    const { rules } = await runWeakenings(sandbox.path);
    expect(rules).toStrictEqual(['configuration']);
});

test('gspot/weakenings prints the first baseline as a note, and reports growth after it', async () => {
    const counts = { 'a.md': { 'docs/missing-paths': { 'docs/missing-paths': 1 } } };
    const grown = { 'a.md': { 'docs/missing-paths': { 'docs/missing-paths': 2 } } };
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]), 'a.md': '# A\n' });
    commitAll(sandbox.path);
    await writeFiles(sandbox.path, { 'gspot.baseline.json': JSON.stringify(counts) });
    expect(await runWeakenings(sandbox.path)).toStrictEqual({
        rules: [],
        notes: ['gspot.baseline.json: it is new'],
    });
    commitAll(sandbox.path, 'baseline');
    await writeFiles(sandbox.path, { 'gspot.baseline.json': JSON.stringify(grown) });
    expect(await runWeakenings(sandbox.path)).toStrictEqual({ rules: ['baseline'], notes: [] });
    await writeFiles(sandbox.path, { 'gspot.baseline.json': JSON.stringify(counts) });
    expect(await runWeakenings(sandbox.path)).toStrictEqual({ rules: [], notes: [] });
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
    const { report } = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['gspot/weakenings'], base }),
    );
    expect(report.checks.flatMap(({ findings }) => findings.map(({ rule }) => rule))).toStrictEqual(['level']);
});

test('gspot/weakenings notes a base that this version of gspot cannot read, and compares nothing', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': 'retired_key = true\n' });
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'gspot.toml'), buildSandboxSettings([]));
    const { rules, notes } = await runWeakenings(sandbox.path);
    expect(rules).toStrictEqual([]);
    expect(notes).toHaveLength(1);
});

test('gspot.toml refuses an ignore that turns gspot/weakenings off', async () => {
    const tables = '[[ignore]]\ncheck = "gspot/weakenings"\nreason = "two words"\n';
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([], { tables }) });
    expect(openSession(sandbox.path)).rejects.toThrow('names one rule');
});
