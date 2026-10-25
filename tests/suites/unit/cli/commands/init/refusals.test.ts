import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { WRITER_LOCK_FILE } from '#cli/config/write.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { CLEAN_BASH_SCRIPT } from '#tests/config/samples.ts';
import { isOnDisk, readTree } from '#tests/setup/system/files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { DOT_GSPOT, GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { readdir, symlink, readFile, writeFile } from 'node:fs/promises';
import { runGspot, buildInitArguments } from '#tests/setup/cli/commands.ts';
import { commitAll, runGitStep, createGitSandbox } from '#tests/setup/system/git.ts';
import { UNCOMMITTED_FORMAT_CASES } from '#tests/config/commands/init/conflicting-config-files.ts';

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
    await using sandbox = await createGitSandbox({ 'package.json': '{', 'source.ts': 'export {};\n' });

    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, buildInitArguments([]));
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('package.json:1:2 is not valid JSON: CloseBraceExpected. Fix the file.\n');
    const structured = await runGspot(sandbox.path, [...buildInitArguments([]), '--json']);
    expect(structured.code).toBe(2);
    expect(structured.stderr).toBe('');
    expect(JSON.parse(structured.stdout)).toStrictEqual({
        error: 'filesystem',
        message: 'package.json:1:2 is not valid JSON: CloseBraceExpected. Fix the file.',
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
    await using sandbox = await createGitSandbox({ 'package.json': '{' });

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
    await using sandbox = await createGitSandbox({ 'control.txt': 'preserve this source\n' });

    const commandArguments = buildInitArguments([]).filter((argument) => argument !== '--yes');
    const before = await readTree(sandbox.path);
    const refused = await runGspot(sandbox.path, commandArguments);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stderr).toBe('There is no terminal to ask in. Pass --yes to accept the plan.\n');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    const accepted = await runGspot(sandbox.path, [...commandArguments, '--yes']);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
    const writtenVersion = await readFile(join(sandbox.path, GSPOT_PATHS.versionPin), 'utf8');
    expect(writtenVersion.trim()).toBe(cliPackage.version);
    expect(await isOnDisk(join(sandbox.path, 'gspot.toml'))).toBe(true);
    expect(await readFile(join(sandbox.path, 'control.txt'), 'utf8')).toBe('preserve this source\n');
});
test('a linked .gspot folder stops init, and nothing outside changes', async () => {
    await using sandbox = await testdir({ 'project/entry.sh': 'echo example\n', 'outside/sentinel': 'authored\n' });
    const project = join(sandbox.path, 'project');
    runGitStep(project, ['init', '--quiet']);
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

test.each(UNCOMMITTED_FORMAT_CASES)('init refuses to replace $path absent from HEAD: $state', async (variant) => {
    const { state, path } = variant;
    await using sandbox = await testdir({ 'source.js': 'export const count = 1;\n' });
    await prepareUncommittedFormat(sandbox.path, variant);
    const before = await readTree(sandbox.path);
    for (const isDryRun of [true, false]) {
        const result = await runGspot(sandbox.path, [
            ...buildInitArguments(['javascript']),
            ...(isDryRun ? ['--dry-run'] : []),
        ]);
        expect(result.code, result.stdout + result.stderr).toBe(2);
        expect(result.stderr).toBe(
            state === 'no Git'
                ? 'gspot needs a Git repository. Run git init, then gspot init.\n'
                : `init replaces ${path}, and Git does not hold them unchanged at HEAD. Commit them or move them away, then run gspot init again.\n`,
        );
        expect(await readTree(sandbox.path)).toStrictEqual(before);
    }
});

async function prepareUncommittedFormat(
    root: string,
    variant: (typeof UNCOMMITTED_FORMAT_CASES)[number],
): Promise<void> {
    const { state, path, original, changed } = variant;
    if (state === 'unborn Git') runGitStep(root, ['init', '-q']);
    else if (state === 'untracked') commitAll(root);
    await writeFile(join(root, path), original);
    if (!(state === 'staged changes' || state === 'unstaged changes')) {
        return;
    }

    commitAll(root);
    await writeFile(join(root, path), changed);
    if (state === 'staged changes') runGitStep(root, ['add', '--', path]);
}
