import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { parseSettings } from '#cli/settings/read.ts';
import * as processes from '#cli/system/processes.ts';
import { GIT_PLAN_CASES } from '#tests/config/init.ts';
import { buildInitArguments } from '#tests/setup/init.ts';
import { textContaining } from '#tests/setup/matchers.ts';
import type { InitJson } from '#cli/types/commands/init.ts';
import { readTree, pathExists } from '#tests/setup/files.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/bash/tools.ts';

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

test('uncommitted changes stop init until they are committed', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'scripts/a.sh': CLEAN_BASH_SCRIPT });
    commitAll(sandbox.path);
    await Bun.write(join(sandbox.path, 'notes.txt'), 'draft\n');
    const argv = buildInitArguments([]);
    const before = await readTree(sandbox.path);
    const diagnostic =
        'The working tree has 1 uncommitted change(s). Commit or stash them before gspot init: Git then keeps every file init replaces, and you review its changes separately.';
    const refused = await runGspot(sandbox.path, argv);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stdout).toBe('');
    expect(refused.stderr).toBe(`${diagnostic}\n`);
    expect(await pathExists(join(sandbox.path, 'gspot.toml'))).toBe(false);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    const structured = await runGspot(sandbox.path, [...argv, '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(2);
    expect(structured.stderr).toBe('');
    expect(JSON.parse(structured.stdout)).toStrictEqual({ error: 'settings', message: diagnostic });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    commitAll(sandbox.path);
    const allowed = await runGspot(sandbox.path, argv);
    expect(allowed.code, allowed.stdout + allowed.stderr).toBe(0);
    expect(await pathExists(join(sandbox.path, 'gspot.toml'))).toBe(true);
});

test('a failed git status stops init before it writes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'control.txt': 'preserve this source\n' });
    commitAll(sandbox.path);
    const before = await readTree(sandbox.path);
    const run = processes.runBlocking;
    using boundary = spyOn(processes, 'runBlocking').mockImplementation((command, options) => {
        if (command[0] !== 'git' || command[1] !== 'status' || command[2] !== '--porcelain')
            return run(command, options);
        return { code: 7, missing: false, duration: 0, stdout: '', stderr: 'status unavailable\n' };
    });
    const argv = buildInitArguments([]);
    const human = await runGspot(sandbox.path, argv);
    expect(human.code, human.stdout + human.stderr).toBe(2);
    expect(human.stdout).toBe('');
    expect(human.stderr).toBe('Git status failed (exit 7): status unavailable\n');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    const structured = await runGspot(sandbox.path, [...argv, '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(2);
    expect(structured.stderr).toBe('');
    expect(JSON.parse(structured.stdout)).toStrictEqual({
        error: 'git',
        message: 'Git status failed (exit 7): status unavailable',
    });
    expect(boundary).toHaveBeenCalledWith(
        ['git', 'status', '--porcelain'],
        expect.objectContaining({ cwd: sandbox.path }),
    );
    expect(await readTree(sandbox.path)).toStrictEqual(before);
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
