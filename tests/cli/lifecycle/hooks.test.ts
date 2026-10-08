// Git runs the gspot hooks through core.hooksPath; a repository that already runs hooks keeps them.
import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { readGitSetting } from '#cli/platform/git.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { writeOutputs } from '#cli/lifecycle/apply.ts';
import { installCommand } from '#cli/commands/install.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import type { InstallJson } from '#cli/types/commands/install.ts';
import { git, commitAll, gitOutput } from '#tests/harness/git.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { hookStatus, installHooks } from '#cli/lifecycle/hooks-path.ts';
import { sourceLauncherDirectory } from '#tests/harness/environment.ts';

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
        writeOutputs(await openSession(root), log);
    }
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

test.each([
    ['another hooks folder', { '.githooks/pre-commit': '#!/bin/sh\n' }, ['config', 'core.hooksPath', '.githooks']],
    ['a Husky folder', { '.husky/pre-commit': 'npm test\n' }, undefined],
    ['a Lefthook configuration', { 'lefthook.yml': 'pre-commit:\n' }, undefined],
    ['a script in the Git hooks folder', {}, undefined],
] as const)('a repository with %s keeps its hooks and gets the lines to add', async (_kind, files, setting) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([], { tables: 'runner = "npm"\n[hooks]\nenabled = true\n' }),
        ...files,
    });
    gitOutput(sandbox.path, ['init', '-q']);
    if (setting !== undefined) gitOutput(sandbox.path, [...setting]);
    if (Object.keys(files).length === 0)
        await Bun.write(join(sandbox.path, '.git/hooks/pre-commit'), '#!/bin/sh\nexit 0\n');
    const before = readGitSetting(sandbox.path, 'core.hooksPath');
    const authoredPaths = Object.keys(files).length === 0 ? ['.git/hooks/pre-commit'] : Object.keys(files);
    const authored = await Promise.all(
        authoredPaths.map(async (path) => ({ path, content: await Bun.file(join(sandbox.path, path)).text() })),
    );
    {
        using log = openOwnership(sandbox.path);
        writeOutputs(await openSession(sandbox.path), log);
    }
    const preview = await installCommand({ cwd: sandbox.path, isDryRun: true });
    expect(preview.exitCode).toBe(0);
    expect(preview.json).toMatchObject({ dryRun: true });
    const plan = preview.json as InstallJson;
    expect(plan.steps!.some(([command]) => command === 'git')).toBe(false);
    expect(preview.json).not.toHaveProperty('hooks');
    const text = installHooks(await hooksOf(sandbox.path));
    expect(plan.notes).toContain(text);
    expect(text).toContain('add these gspot lines to them');
    expect(text).toContain('pre-commit: npm exec --no -- gspot check --hook pre-commit');
    expect(text).toContain('pre-push: npm exec --no -- gspot check --hook pre-push -- "$@"');
    expect(readGitSetting(sandbox.path, 'core.hooksPath')).toBe(before);
    for (const { path, content } of authored) expect(await Bun.file(join(sandbox.path, path)).text()).toBe(content);
    expect(hookStatus(await hooksOf(sandbox.path))).toMatchObject({ ready: true });
});

test('a policy without hooks installs none', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': buildPolicy([], {}) });
    gitOutput(sandbox.path, ['init', '-q']);
    expect(installHooks(await hooksOf(sandbox.path))).toBe('');
    expect(hookStatus(await hooksOf(sandbox.path))).toStrictEqual({ ready: true, text: 'none' });
    expect(readGitSetting(sandbox.path, 'core.hooksPath')).toBeUndefined();
});

test('a commit in a linked worktree runs the staged checks and blocks a defect', async () => {
    await using sandbox = await testdir();
    const main = join(sandbox.path, 'main');
    const linked = join(sandbox.path, 'linked');
    const finder = [
        process.execPath,
        '-e',
        'const found = process.argv.slice(1).filter((path) => require("node:fs").readFileSync(path, "utf8").includes("DEFECT")); found.forEach((path) => console.log(path)); process.exitCode = found.length > 0 ? 1 : 0;',
        '{files}',
    ];
    const check = `[check."sandbox/defect"]\ncommand = ${JSON.stringify(finder)}\npaths = ["src/**"]\nstage = "commit"\n[check."sandbox/defect".output]\nformat = "lines"\n`;
    await createFileTree(main, {
        'gspot.toml': buildPolicy([], { tables: `[hooks]\nenabled = true\n[agent_rules]\nenabled = false\n${check}` }),
        'src/kept.txt': 'clean\n',
    });
    commitAll(main);
    {
        using log = openOwnership(main);
        writeOutputs(await openSession(main), log);
    }
    const applied = await runGspot(main, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const formatted = await runGspot(main, ['check', '--only', 'files/taplo-format', '--fix']);
    expect(formatted.code, formatted.stdout + formatted.stderr).toBe(0);
    const prepared = await runGspot(main, ['install']);
    expect(prepared.code, prepared.stdout + prepared.stderr).toBe(0);
    commitAll(main);
    gitOutput(main, ['worktree', 'add', '-q', '-b', 'topic', linked]);
    const installed = await runGspot(linked, ['install']);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    const environment = {
        PATH: `${sourceLauncherDirectory}${delimiter}${environmentVariables()['PATH'] ?? ''}`,
        NO_COLOR: '1',
    };
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
command = ${JSON.stringify([process.execPath, '-e', 'if ((await Bun.file("source.txt").text()).trim() === "invalid") { console.log("Indexed defect"); process.exitCode = 1; }'])}
`,
        'nested config/source.txt': 'invalid\n',
    });
    expect(git(sandbox.path, ['init', '-q']).code).toBe(0);
    {
        using log = openOwnership(project);
        writeOutputs(await openSession(project), log);
    }
    const applied = await runGspot(project, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const formatted = await runGspot(project, ['check', '--only', 'files/taplo-format', '--fix']);
    expect(formatted.code, formatted.stdout + formatted.stderr).toBe(0);
    const installed = await runGspot(project, ['install']);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    expect(git(sandbox.path, ['add', '-A']).code).toBe(0);
    await Bun.write(join(project, 'source.txt'), 'corrected working tree\n');
    const environment = { PATH: `${sourceLauncherDirectory}${delimiter}${environmentVariables()['PATH'] ?? ''}` };
    const rejected = git(sandbox.path, ['hook', 'run', 'pre-commit'], environment);
    expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
    expect(rejected.stdout + rejected.stderr).toContain('Indexed defect');
    expect(await Bun.file(join(project, 'source.txt')).text()).toBe('corrected working tree\n');
    expect(git(sandbox.path, ['add', 'nested config/source.txt']).code).toBe(0);
    const corrected = git(sandbox.path, ['hook', 'run', 'pre-commit'], environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});
