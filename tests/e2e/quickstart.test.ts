import { test, expect } from 'bun:test';
import { join, dirname } from 'node:path';
import { parse } from '@decimalturn/toml-patch';
import { testdir, createFileTree } from 'testdirs';
import { hasToolBuild } from '#tests/setup/system.ts';
import { runCommand } from '#tests/setup/processes.ts';
import { listMisePins } from '#cli/configurations/tools.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import packageManifest from '#cli-package' with { type: 'json' };
import { readManifests } from '#cli/configurations/manifests.ts';
import { runGit, commitAll, readGitOutput } from '#tests/setup/git.ts';
import { testRunFolder, buildSandboxPath } from '#tests/setup/install.ts';
import { TUTORIALS, QUICKSTART_COMMANDS } from '#tests/data/quickstart.ts';

test.each(
    TUTORIALS.filter(
        (row) => row.configuration !== 'swift' || (hasToolBuild('swiftlint') && Bun.which('swift') !== null),
    ),
)('$configuration quickstart reports its finding through the installed hook and passes after the fix', async (row) => {
    await using sandbox = await testdir();
    const root = join(sandbox.path, row.folder);
    await mkdir(root);
    const environment = {
        PATH: buildSandboxPath(),
        MISE_CONFIG_DIR: join(sandbox.path, 'config'),
        MISE_DATA_DIR: join(sandbox.path, 'data'),
        MISE_STATE_DIR: join(sandbox.path, 'state'),
        MISE_CACHE_DIR: join(sandbox.path, 'cache'),
        MISE_CEILING_PATHS: dirname(root),
    };

    const runtimePins = (
        parse(await readFile(join(import.meta.dir, '../../mise.toml'), 'utf8')) as {
            tools: Record<string, string>;
        }
    ).tools;
    await linkQuickstartTools(root, environment);
    for (const command of [
        ['mise', 'use', `node@${runtimePins['node']!}`, `npm:@gspothq/cli@${packageManifest.version}`],
        ...row.projectCommands,
    ]) {
        const created = await runCommand([...command], { cwd: root, env: environment });
        expect(created.code, created.stdout + created.stderr).toBe(0);
    }
    await createFileTree(root, row.files);
    commitAll(root);
    for (const { command, code } of [
        { command: ['mise', 'exec', '--', 'gspot', 'init', '--yes'], code: 0 },
        ...QUICKSTART_COMMANDS,
    ]) {
        const result = await runCommand([...command], { cwd: root, env: environment });
        expect(result.code, result.stdout + result.stderr).toBe(code);
    }
    const source = join(root, row.sourcePath);
    const original = await readFile(source);
    readGitOutput(root, ['add', '-A']);
    expect(runGit(root, ['commit', '-qm', 'chore: Set up gspot'], environment).code).toBe(0);
    await writeFile(source, row.invalidSource);
    const command = ['mise', 'exec', '--', 'gspot', 'check', '--only', row.check];
    const rejected = await runCommand(command, { cwd: root, env: environment });
    expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
    expect(rejected.stdout).toContain(row.message);
    rejectInvalidCommit();
    readGitOutput(root, ['restore', '--source=HEAD', '--staged', '--worktree', '--', row.sourcePath]);
    expect(await readFile(source)).toStrictEqual(original);
    const corrected = await runCommand(command, { cwd: root, env: environment });
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);

    /** Check that the installed hook rejects the invalid staged source. */
    function rejectInvalidCommit(): void {
        readGitOutput(root, ['add', '-A']);
        const refused = runGit(root, ['commit', '-qm', 'feat: Add invalid source'], environment);
        expect(refused.code).not.toBe(0);
        expect(refused.stdout + refused.stderr).toContain(row.rule);
    }
});

/**
 * Link the installed pins into this tutorial's isolated mise directories.
 * @param tutorialRoot the tutorial repository.
 * @param environment the tutorial's isolated mise paths.
 * @returns after linking every supported pin.
 */
async function linkQuickstartTools(tutorialRoot: string, environment: Record<string, string>): Promise<void> {
    for (const pin of listMisePins(
        [...readManifests(createReadCache(process.cwd())).values()],
        createReadCache(process.cwd()),
    ).filter((pin) => hasToolBuild(pin.name))) {
        const requirement = `${pin.name}@${pin.version}`;

        const installed = await runCommand(
            pin.name === 'uv' ? ['mise', 'which', 'uv'] : ['mise', 'where', requirement],
            {
                cwd: testRunFolder(),
            },
        );
        expect(installed.code, `Quickstart tool lookup failed: ${installed.stdout}${installed.stderr}`).toBe(0);
        const location = installed.stdout.trim();
        const folder = pin.name === 'uv' ? dirname(location) : location;

        const linked = await runCommand(['mise', 'link', requirement, folder], { cwd: tutorialRoot, env: environment });
        expect(linked.code, `Quickstart tool linking failed: ${linked.stdout}${linked.stderr}`).toBe(0);
    }
}
