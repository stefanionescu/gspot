// Git runs the gspot hooks through core.hooksPath; a repository that already runs hooks keeps them.
import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { installCommand } from '#cli/commands/contracts.ts';
import { readGitSetting } from '#cli/platform/git/public.ts';
import { environmentVariables } from '#cli/platform/public.ts';
import { writeGeneratedFiles } from '#cli/lifecycle/public.ts';
import { hookStatus } from '#cli/lifecycle/install/contracts.ts';
import { git, commitAll, gitOutput } from '#tests/harness/git.ts';
import { openOwnership } from '#cli/lifecycle/ownership/public.ts';
import { createInstallationRegistry } from '#tests/harness/registry.ts';
import { INDEX_COMMAND, SAMPLE_COMMAND } from '#tests/config/tools/lifecycle/hooks.ts';
import { useEnvironment, sourceLauncherDirectory } from '#tests/harness/environment.ts';

// The policy and repository of a session: what install and doctor both read.

async function hooksOf(root: string) {
    const session = await openSession(root);
    return { policy: session.policyFiles.policy, repository: session.repository };
}

test.each(['', 'app/'])('install points core.hooksPath at %s.gspot/hooks', async (prefix) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        [`${prefix}gspot.toml`]: buildPolicy([], { tables: '[hooks]\nenabled = true\n' }),
    });
    gitOutput(sandbox.path, ['init', '-q']);
    const root = join(sandbox.path, prefix);
    expect(hookStatus(await hooksOf(root))).toStrictEqual({ ready: false, text: 'not installed; run gspot install' });
    {
        using log = openOwnership(root);
        writeGeneratedFiles(await openSession(root), log);
    }
    await using registry = await createInstallationRegistry(root, runTestCommand);
    using _environment = useEnvironment(registry.environment);
    const preview = await installCommand({ cwd: root, isDryRun: true });
    expect(preview.exitCode).toBe(0);
    expect(preview.json).toMatchObject({
        dryRun: true,
        hooks: `${prefix}.gspot/hooks`,
        steps: [
            ['npm', 'install', '--package-lock-only', '--no-audit', '--no-fund', '--omit-lockfile-registry-resolved'],
            ['git', 'config', 'core.hooksPath', `${prefix}.gspot/hooks`],
            ['npm', 'ci', '--no-audit', '--no-fund', '--omit-lockfile-registry-resolved'],
        ],
    });
    expect(readGitSetting(sandbox.path, 'core.hooksPath')).toBeUndefined();
    const installed = await installCommand({ cwd: root, isDryRun: false });
    expect(installed.exitCode, installed.text).toBe(0);
    expect(installed.json).toMatchObject({ installed: true });
    expect(installed.text).toContain(`installed hooks: core.hooksPath is ${prefix}.gspot/hooks`);
    expect(readGitSetting(sandbox.path, 'core.hooksPath')).toBe(`${prefix}.gspot/hooks`);
    expect(hookStatus(await hooksOf(root))).toStrictEqual({ ready: true, text: `${prefix}.gspot/hooks: installed` });
});

test('a commit in a linked worktree runs staged checks and blocks a finding', async () => {
    await using sandbox = await testdir();
    const main = join(sandbox.path, 'main');
    const linked = join(sandbox.path, 'linked');

    await createFileTree(main, {
        'gspot.toml': buildPolicy([], {
            tables: `[hooks]\nenabled = true\n[agent_rules]\nenabled = false\n[check."sandbox/defect"]\ncommand = ${JSON.stringify([process.execPath, '-e', SAMPLE_COMMAND, '{files}'])}\npaths = ["src/**"]\nstage = "commit"\n[check."sandbox/defect".output]\nformat = "lines"\n`,
        }),
        'src/kept.txt': 'clean\n',
    });
    commitAll(main);
    {
        using log = openOwnership(main);
        writeGeneratedFiles(await openSession(main), log);
    }
    await using registry = await createInstallationRegistry(main, runTestCommand);
    const environment = {
        ...registry.environment,
        PATH: `${sourceLauncherDirectory}${delimiter}${environmentVariables()['PATH'] ?? ''}`,
        NO_COLOR: '1',
    };
    using _environment = useEnvironment(environment);
    const applied = await runGspot(main, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const formatted = await runGspot(main, ['check', '--only', 'files/taplo-format', '--fix']);
    expect(formatted.code, formatted.stdout + formatted.stderr).toBe(0);
    const prepared = await runGspot(main, ['install'], registry.environment);
    expect(prepared.code, prepared.stdout + prepared.stderr).toBe(0);
    commitAll(main);
    gitOutput(main, ['worktree', 'add', '-q', '-b', 'topic', linked]);
    const installed = await runGspot(linked, ['install'], registry.environment);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    await Bun.write(join(linked, 'src/added.txt'), 'DEFECT\n');
    gitOutput(linked, ['add', 'src/added.txt']);
    const blocked = git(linked, ['commit', '-qm', 'Defect'], environment);
    expect(blocked.code, blocked.stdout + blocked.stderr).not.toBe(0);
    expect(blocked.stdout + blocked.stderr).toContain('src/added.txt');
    await Bun.write(join(linked, 'src/added.txt'), 'clean\n');
    gitOutput(linked, ['add', 'src/added.txt']);
    const accepted = git(linked, ['commit', '-qm', 'Clean'], environment);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
});

test('a hook selects configuration below the Git root and checks its exact index', async () => {
    await using sandbox = await testdir();
    const project = join(sandbox.path, 'nested config');
    await createFileTree(sandbox.path, {
        'nested config/gspot.toml': `configurations = []
[agent_rules]
enabled = false
[hooks]
enabled = true
[check."project/content"]
stage = "commit"
paths = ["source.txt"]
command = ${JSON.stringify([process.execPath, '-e', INDEX_COMMAND])}
`,
        'nested config/source.txt': 'invalid\n',
    });
    expect(git(sandbox.path, ['init', '-q']).code).toBe(0);
    {
        using log = openOwnership(project);
        writeGeneratedFiles(await openSession(project), log);
    }
    await using registry = await createInstallationRegistry(project, runTestCommand);
    const applied = await runGspot(project, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const formatted = await runGspot(project, ['check', '--only', 'files/taplo-format', '--fix']);
    expect(formatted.code, formatted.stdout + formatted.stderr).toBe(0);
    const installed = await runGspot(project, ['install'], registry.environment);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    expect(git(sandbox.path, ['add', '-A']).code).toBe(0);
    await Bun.write(join(project, 'source.txt'), 'corrected working tree\n');
    const environment = {
        ...registry.environment,
        PATH: `${sourceLauncherDirectory}${delimiter}${environmentVariables()['PATH'] ?? ''}`,
    };
    const rejected = git(sandbox.path, ['hook', 'run', 'pre-commit'], environment);
    expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
    expect(rejected.stdout + rejected.stderr).toContain('Indexed defect');
    expect(await Bun.file(join(project, 'source.txt')).text()).toBe('corrected working tree\n');
    expect(git(sandbox.path, ['add', 'nested config/source.txt']).code).toBe(0);
    const corrected = git(sandbox.path, ['hook', 'run', 'pre-commit'], environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});
