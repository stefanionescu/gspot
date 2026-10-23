import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/setup/system/git.ts';
import { readdir, symlink, readFile } from 'node:fs/promises';
import { isOnDisk, readTree } from '#tests/setup/system/files.ts';
import { WRITER_LOCK_FILE } from '#cli/config/ownership/writer.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { DOT_GSPOT, GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { runGspot, buildInitArguments } from '#tests/setup/cli/commands.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/checks/language/bash/sandbox.ts';

test('init with an unknown configuration exits 2 and writes nothing', async () => {
    await using sandbox = await testdir({ 'scripts/a.sh': CLEAN_BASH_SCRIPT });

    commitAll(sandbox.path);
    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, [...buildInitArguments([]), '--configurations', 'bassh']);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(result.stdout + result.stderr).toBe(
        'There is no configuration called `bassh`. Did you mean `bash`? Run `gspot list configurations` to see the available configurations.\n',
    );
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
    expect(JSON.parse(result.stdout)).toStrictEqual({
        error: 'settings',
        message:
            'This repository already has a gspot.toml. Run `gspot doctor` to inspect its setup and see suggested commands.',
    });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('init --json without --yes names --yes before reading the repository', async () => {
    await using sandbox = await testdir({ 'package.json': '{' });

    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, ['init', '--json']);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout)).toStrictEqual({
        error: 'arguments',
        message: '--json needs --yes or --dry-run, because gspot cannot ask while it prints JSON.',
    });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
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
    const writtenVersion = await readFile(join(sandbox.path, GSPOT_PATHS.versionPin), 'utf8');
    expect(accepted.stdout.split('\n')).toContain(`gspot ${writtenVersion.trim()}`);
    expect(await isOnDisk(join(sandbox.path, 'gspot.toml'))).toBe(true);
    expect(await readFile(join(sandbox.path, 'control.txt'), 'utf8')).toBe('preserve this source\n');
});
test('a linked .gspot folder stops init, and nothing outside changes', async () => {
    await using sandbox = await testdir({ 'project/entry.sh': 'echo example\n', 'outside/sentinel': 'authored\n' });
    const project = join(sandbox.path, 'project');
    const outside = join(sandbox.path, 'outside');
    await symlink(outside, join(project, DOT_GSPOT));
    const refused = await runGspot(project, buildInitArguments(['bash']));
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stderr).toBe(
        `A parent of ${WRITER_LOCK_FILE} is a link or is not a folder. Choose a folder without links.\n`,
    );
    expect(await readFile(join(outside, 'sentinel'), 'utf8')).toBe('authored\n');
    expect(await readdir(outside)).toStrictEqual(['sentinel']);
    expect(await isOnDisk(join(project, 'gspot.toml'))).toBe(false);
});
