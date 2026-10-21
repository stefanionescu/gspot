import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { commitAll } from '#tests/setup/git.ts';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { matchSubstring } from '#tests/setup/matchers.ts';
import { isOnDisk, readTree } from '#tests/setup/files.ts';
import { type InitJson } from '#cli/types/commands/init.ts';
import { GIT_PLAN_CASES } from '#tests/data/commands/init.ts';
import { buildInitArguments } from '#tests/setup/builders.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/data/checks/bash/samples.ts';

test('init with an unknown configuration exits 2 and writes nothing', async () => {
    await using sandbox = await testdir({ 'scripts/a.sh': CLEAN_BASH_SCRIPT });

    commitAll(sandbox.path);
    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, [...buildInitArguments([]), '--configurations', 'bassh']);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(result.stdout + result.stderr).toContain('bassh');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('init refuses an unreadable package.json before writing', async () => {
    await using sandbox = await testdir({ 'package.json': '{', 'source.ts': 'export {};\n' });

    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, buildInitArguments([]));
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
        'package.json is not valid JSON: Invalid JSON at offset 1: CloseBraceExpected. Fix the file.\n',
    );
    const structured = await runGspot(sandbox.path, [...buildInitArguments([]), '--json']);
    expect(structured.code).toBe(2);
    expect(structured.stderr).toBe('');
    expect(JSON.parse(structured.stdout)).toStrictEqual({
        error: 'filesystem',
        message: 'package.json is not valid JSON: Invalid JSON at offset 1: CloseBraceExpected. Fix the file.',
    });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('init in a repository that already has gspot.toml exits 2 and changes nothing', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash'], { rules: true }),
        'scripts/a.sh': CLEAN_BASH_SCRIPT,
    });

    commitAll(sandbox.path);
    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, buildInitArguments([], { json: true }));
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
        error: 'settings',
        message: matchSubstring('gspot doctor'),
    });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('init --json without --yes names --yes before reading the repository', async () => {
    await using sandbox = await testdir({ 'package.json': '{' });

    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, ['init', '--json']);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({ error: 'arguments', message: matchSubstring('--yes') });
    expect(result.stdout).not.toContain('package.json');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test.each([...GIT_PLAN_CASES])('init in $name plans only the Git changes that apply', async ({ hasGit }) => {
    await using sandbox = await testdir({ 'control.txt': 'preserve this source\n' });

    if (hasGit) commitAll(sandbox.path);
    const commandArguments = [...buildInitArguments([], { json: true }), '--no-configurations'];
    const before = await readTree(sandbox.path);
    const preview = await runGspot(sandbox.path, [...commandArguments, '--dry-run']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    expect(preview.stderr).toBe('');
    const report = JSON.parse(preview.stdout) as Required<Pick<InitJson, 'plan' | 'settings'>>;
    const changes = new Set(report.plan.change.map((entry) => entry.path));
    expect(changes.has('.gitignore')).toBe(hasGit);
    expect(changes.has('.gspot/hooks')).toBe(hasGit);
    expect(changes.has('.gitattributes')).toBe(hasGit);
    expect(parseSettings(report.settings, undefined).hooks).toBeDefined();
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    const initialized = await runGspot(sandbox.path, commandArguments);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    expect(await isOnDisk(join(sandbox.path, '.gitignore'))).toBe(hasGit);
    expect(await isOnDisk(join(sandbox.path, '.gitattributes'))).toBe(hasGit);
    expect(await readFile(join(sandbox.path, 'control.txt'), 'utf8')).toBe('preserve this source\n');
});

test('init without a terminal names --yes once and writes only after --yes', async () => {
    await using sandbox = await testdir({ 'control.txt': 'preserve this source\n' });

    const commandArguments = buildInitArguments([]).filter((argument) => argument !== '--yes');
    const before = await readTree(sandbox.path);
    const refused = await runGspot(sandbox.path, commandArguments);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stderr).toBe('There is no terminal to ask in. Pass --yes to accept the plan.\n');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    const accepted = await runGspot(sandbox.path, [...commandArguments, '--yes']);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
    const writtenVersion = await readFile(join(sandbox.path, '.gspot/version'), 'utf8');
    expect(accepted.stdout.split('\n')).toContain(`gspot ${writtenVersion.trim()}`);
    expect(await isOnDisk(join(sandbox.path, 'gspot.toml'))).toBe(true);
    expect(await readFile(join(sandbox.path, 'control.txt'), 'utf8')).toBe('preserve this source\n');
});
