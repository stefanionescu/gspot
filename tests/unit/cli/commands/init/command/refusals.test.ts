import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { GIT_PLAN_CASES } from '#tests/config/init.ts';
import { buildInitArguments } from '#tests/setup/init.ts';
import { textContaining } from '#tests/setup/matchers.ts';
import type { InitJson } from '#cli/types/commands/init.ts';
import { readTree, pathExists } from '#tests/setup/files.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/bash/tools.ts';
import { git, commitAll, gitOutput } from '#tests/setup/git.ts';

test('init with an unknown configuration exits 2 and writes nothing', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'scripts/a.sh': CLEAN_BASH_SCRIPT });
    commitAll(sandbox.path);
    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, [...buildInitArguments([]), '--configurations', 'bassh']);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(result.stdout + result.stderr).toContain('bassh');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test.each([true, false])('init, install, and check preserve uncommitted work (has commits: %s)', async (hasCommits) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'scripts/a.sh': CLEAN_BASH_SCRIPT });
    gitOutput(sandbox.path, ['init', '-q']);
    if (hasCommits) commitAll(sandbox.path);
    await Bun.write(join(sandbox.path, 'scripts/a.sh'), CLEAN_BASH_SCRIPT + '\n');
    gitOutput(sandbox.path, ['add', 'scripts/a.sh']);
    await Bun.write(join(sandbox.path, 'scripts/a.sh'), CLEAN_BASH_SCRIPT + '\n\n');
    await Bun.write(join(sandbox.path, 'notes.txt'), 'draft\n');
    const staged = gitOutput(sandbox.path, ['diff', '--cached', '--binary']);
    const head = git(sandbox.path, ['rev-parse', '--verify', 'HEAD']);
    const preview = await runGspot(sandbox.path, [...buildInitArguments(['none']), '--dry-run', '--json']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    expect(await pathExists(join(sandbox.path, 'gspot.toml'))).toBe(false);
    const initialized = await runGspot(sandbox.path, buildInitArguments(['none'], { json: true }));
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    expect(await pathExists(join(sandbox.path, 'gspot.toml'))).toBe(true);
    const installed = await runGspot(sandbox.path, ['install']);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    const checked = await runGspot(sandbox.path, ['check', '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    expect(await Bun.file(join(sandbox.path, 'scripts/a.sh')).text()).toBe(CLEAN_BASH_SCRIPT + '\n\n');
    expect(await Bun.file(join(sandbox.path, 'notes.txt')).text()).toBe('draft\n');
    expect(gitOutput(sandbox.path, ['diff', '--cached', '--binary'])).toBe(staged);
    expect(git(sandbox.path, ['rev-parse', '--verify', 'HEAD'])).toStrictEqual(head);
});

test('init refuses an unreadable package.json before writing', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'package.json': '{', 'source.ts': 'export {};\n' });
    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, buildInitArguments([]));
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(result.stderr).toContain('package.json');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('init in a repository that already has gspot.toml exits 2 and changes nothing', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'configurations = ["bash"]\n',
        'scripts/a.sh': CLEAN_BASH_SCRIPT,
    });
    commitAll(sandbox.path);
    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, buildInitArguments([], { json: true }));
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
        error: 'settings',
        message: textContaining('gspot doctor'),
    });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('init --json without --yes names --yes before reading the repository', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'package.json': '{' });
    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, ['init', '--json']);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({ error: 'prompt', message: textContaining('--yes') });
    expect(result.stdout).not.toContain('package.json');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test.each([...GIT_PLAN_CASES])('init in $name plans only the Git changes that apply', async ({ hasGit }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'control.txt': 'preserve this source\n' });
    if (hasGit) commitAll(sandbox.path);
    const argv = buildInitArguments(['none'], { json: true });
    const before = await readTree(sandbox.path);
    const preview = await runGspot(sandbox.path, [...argv, '--dry-run']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    expect(preview.stderr).toBe('');
    const report = JSON.parse(preview.stdout) as Required<Pick<InitJson, 'plan' | 'settings'>>;
    const changes = report.plan.change.map((entry) => entry.path);
    expect(changes.includes('.gitignore')).toBe(hasGit);
    expect(changes.includes('.gspot/hooks')).toBe(hasGit);
    expect(changes).toContain('.gitattributes');
    expect(parseSettings(report.settings).hooks).toBeDefined();
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    const initialized = await runGspot(sandbox.path, argv);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    expect(await pathExists(join(sandbox.path, '.gitignore'))).toBe(hasGit);
    expect(await pathExists(join(sandbox.path, '.gitattributes'))).toBe(hasGit);
    expect(await Bun.file(join(sandbox.path, 'control.txt')).text()).toBe('preserve this source\n');
});

test('init without a terminal names --yes once and writes only after --yes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'control.txt': 'preserve this source\n' });
    const argv = buildInitArguments([]).filter((argument) => argument !== '--yes');
    const before = await readTree(sandbox.path);
    const refused = await runGspot(sandbox.path, argv);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stderr).toBe('There is no terminal to ask in. Pass --yes to accept the plan.\n');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    const accepted = await runGspot(sandbox.path, [...argv, '--yes']);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
    expect(await pathExists(join(sandbox.path, 'gspot.toml'))).toBe(true);
    expect(await Bun.file(join(sandbox.path, 'control.txt')).text()).toBe('preserve this source\n');
});
