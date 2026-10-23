import { test, expect } from 'bun:test';
import { join, dirname } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import cliPackage from '#cli-package' with { type: 'json' };
import { runCommand } from '#tests/setup/system/processes.ts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { hasToolBuild } from '#tests/setup/system/platform.ts';
import { listMisePins } from '#cli/configurations/declared-tools.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { runGit, commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { GIT_ISOLATION_ENVIRONMENT } from '#tests/config/setup/system/git.ts';
import { SWIFT_TUTORIAL, PYTHON_TUTORIAL } from '#tests/config/e2e/quickstart.ts';
import { readRuntimePins, TEST_RUN_FOLDER } from '#tests/setup/runner/run-folder.ts';

test('the Python quickstart reports its finding through the installed hook and passes after the fix', async () => {
    await runQuickstart(PYTHON_TUTORIAL);
});

test.skipIf(!hasToolBuild('swiftlint') || Bun.which('swift') === null)(
    'the Swift quickstart reports its finding through the installed hook and passes after the fix',
    async () => {
        await runQuickstart(SWIFT_TUTORIAL);
    },
);

/**
 * Create the tutorial project, set up gspot as the quickstart says, and check that the hook rejects the invalid source.
 *
 * @param row the tutorial.
 */
async function runQuickstart(row: typeof PYTHON_TUTORIAL | typeof SWIFT_TUTORIAL): Promise<void> {
    await using sandbox = await testdir();
    const root = join(sandbox.path, row.folder);
    await mkdir(root);
    const environment = {
        // uv init writes the author of the global Git settings into pyproject.toml. Without them, each machine starts the
        // same project.
        ...GIT_ISOLATION_ENVIRONMENT,
        MISE_CONFIG_DIR: join(sandbox.path, 'config'),
        MISE_DATA_DIR: join(sandbox.path, 'data'),
        MISE_STATE_DIR: join(sandbox.path, 'state'),
        MISE_CACHE_DIR: join(sandbox.path, 'cache'),
        MISE_CEILING_PATHS: dirname(root),
    };
    const runtimePins = await readRuntimePins();
    await linkQuickstartTools(root, environment);
    for (const command of [
        ['mise', 'use', `node@${runtimePins.node}`, `npm:@gspothq/cli@${cliPackage.version}`],
        ...row.projectCommands,
    ]) {
        const created = await runCommand([...command], { cwd: root, env: environment });
        expect(created.code, created.stdout + created.stderr).toBe(0);
    }
    await createFileTree(root, row.files);
    commitAll(root);
    // The tutorial commands. The first check fails on what the fixers then correct, unless the project starts clean.
    for (const { command, code } of [
        { command: ['mise', 'exec', '--', 'gspot', 'init', '--yes'], code: 0 },
        { command: ['mise', 'exec', '--', 'gspot', 'install'], code: 0 },
        { command: ['mise', 'exec', '--', 'gspot', 'check'], code: row.firstCheckCode },
        { command: ['mise', 'exec', '--', 'gspot', 'check', '--fix'], code: 0 },
        { command: ['mise', 'exec', '--', 'gspot', 'check'], code: 0 },
    ]) {
        const result = await runCommand([...command], { cwd: root, env: environment });
        expect(result.code, `${command.join(' ')}\n${result.stdout}${result.stderr}`).toBe(code);
    }
    const source = join(root, row.sourcePath);
    const original = await readFile(source);
    runGitStep(root, ['add', '-A']);
    const committed = runGit(root, ['commit', '-qm', 'chore: Set up gspot'], environment);
    expect(committed.code, committed.stdout + committed.stderr).toBe(0);
    await writeFile(source, row.invalidSource);
    const command = ['mise', 'exec', '--', 'gspot', 'check', '--only', row.check];
    const rejected = await runCommand(command, { cwd: root, env: environment });
    expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
    expect(rejected.stdout).toContain(row.message);
    assertCommitRejected(root, row.rule, environment);
    runGitStep(root, ['restore', '--source=HEAD', '--staged', '--worktree', '--', row.sourcePath]);
    expect(await readFile(source)).toStrictEqual(original);
    const corrected = await runCommand(command, { cwd: root, env: environment });
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
}

/**
 * Link the installed tool pins into the mise folders of the tutorial.
 *
 * @param tutorialRoot repository that the quickstart test creates.
 * @param environment mise folder variables for that repository.
 */
async function linkQuickstartTools(tutorialRoot: string, environment: Record<string, string>): Promise<void> {
    for (const pin of listMisePins([...readConfigurations().values()]).filter((pin) => hasToolBuild(pin.name))) {
        const requirement = `${pin.name}@${pin.version}`;
        const installed = await runCommand(
            pin.name === 'uv' ? ['mise', 'which', 'uv'] : ['mise', 'where', requirement],
            { cwd: TEST_RUN_FOLDER },
        );
        expect(installed.code, `Quickstart tool lookup failed: ${installed.stdout}${installed.stderr}`).toBe(0);
        const location = installed.stdout.trim();
        // The uv archive keeps its program in a subfolder of its install folder, so link the folder that holds the
        // program.
        const folder = pin.name === 'uv' ? dirname(location) : location;
        const linked = await runCommand(['mise', 'link', requirement, folder], { cwd: tutorialRoot, env: environment });
        expect(linked.code, `Quickstart tool linking failed: ${linked.stdout}${linked.stderr}`).toBe(0);
    }
}

/** Check that the installed hook rejects the invalid staged source. */
function assertCommitRejected(repositoryRoot: string, rule: string, environment: Record<string, string>): void {
    runGitStep(repositoryRoot, ['add', '-A']);
    const refused = runGit(repositoryRoot, ['commit', '-qm', 'feat: Add invalid source'], environment);
    expect(refused.code, refused.stdout + refused.stderr).toBe(1);
    expect(refused.stdout + refused.stderr).toContain(rule);
}
