import { existsSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/engine/session.ts';
import { join, dirname, delimiter } from 'node:path';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { buildHookFiles } from '#cli/generation/hooks.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { HOOKS_SETTINGS } from '#tests/config/setup/sandboxes.ts';
import { readCallRecords } from '#tests/setup/system/programs.ts';
import { writeProgramCommand } from '#tests/setup/system/fakes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { chmod, mkdir, realpath, writeFile } from 'node:fs/promises';
import { HOOK_CASES, START_COMMANDS } from '#tests/config/generation/files.ts';
import { selectStartRunner } from '#cli/repository/javascript/package-manager.ts';
import { createGitSandbox, createLfsRepository } from '#tests/setup/sandboxes/repositories.ts';

test('gspot writes check hooks without unused Git LFS hooks', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: HOOKS_SETTINGS }),
    });
    const written = buildGeneratedFiles(await openSession(sandbox.path)).files.filter((file) =>
        file.path.startsWith(`${GSPOT_PATHS.hooks}/`),
    );
    expect(written.map((file) => file.path)).toStrictEqual(
        ['commit-msg', 'pre-commit', 'pre-push'].map((name) => `${GSPOT_PATHS.hooks}/${name}`),
    );
});

test.each(START_COMMANDS.map(([program, packageManager, prefix]) => ({ program, packageManager, prefix })))(
    'each hook script uses the $program start command to run one check, with gspot.toml below the Git top level',
    async ({ program, packageManager, prefix }) => {
        const folder = 'project';
        await using sandbox = await createGitSandbox({
            [join(folder, 'gspot.toml')]: buildSandboxSettings([], { rules: true }),
            'node_modules/@gspothq/cli/package.json': '{}',
        });

        const root = join(sandbox.path, folder);
        if (packageManager !== undefined)
            await writeFile(
                join(root, 'package.json'),
                JSON.stringify({
                    packageManager,
                    devDependencies: { '@gspothq/cli': '1.2.3' },
                }),
            );
        const files = buildHookFiles(
            selectStartRunner(root),
            HOOK_CASES.map(([name]) => name),
            { hasLfsFiles: false },
        );
        expect(files.map((file) => file.path)).toStrictEqual(
            HOOK_CASES.map(([name]) => name).map((name) => `${GSPOT_PATHS.hooks}/${name}`),
        );
        await writeProgramCommand(
            sandbox.path,
            `bin/${program}`,
            'fakes/tool',
            '--record',
            '-',
            '--environment',
            'GSPOT_HOOK',
            '--',
        );
        await writeProgramCommand(sandbox.path, 'bin/git-lfs', 'fakes/tool');
        const cwd = await realpath(sandbox.path);
        for (const [index, [name, commandArguments]] of HOOK_CASES.entries()) {
            const file = files[index]!;
            expect(file).toMatchObject({ executable: true });
            const path = join(sandbox.path, name);
            await writeFile(path, file.content);
            await chmod(path, 0o755);
            const result = await runCommand(
                ['git', '-c', `core.hooksPath=${sandbox.path}`, 'hook', 'run', name, '--', ...commandArguments],
                {
                    cwd: sandbox.path,
                    env: {
                        PATH: `${join(sandbox.path, 'bin')}${delimiter}${readEnvironmentVariable('PATH') ?? ''}`,
                    },
                },
            );
            expect(result.code, result.stdout + result.stderr).toBe(0);
            const suffix = name === 'commit-msg' ? [join(cwd, 'message')] : [...commandArguments];
            const selector = name === 'pre-commit' ? ['--staged', '--stage', 'commit'] : ['--hook', name, '--'];
            expect(JSON.parse(result.stderr)).toStrictEqual({
                arguments: [...prefix, 'check', ...selector, ...suffix],
                environment: { GSPOT_HOOK: null },
                cwd,
            });
        }
    },
);

test.each(START_COMMANDS)(
    'a hook names %s and the Git client PATH when its runner is missing',
    async (program, packageManager) => {
        await using sandbox = await createGitSandbox({});
        if (packageManager !== undefined)
            await writeFile(
                join(sandbox.path, 'package.json'),
                JSON.stringify({
                    packageManager,
                    devDependencies: { '@gspothq/cli': '0.0.0-test' },
                }),
            );
        const hook = buildHookFiles(selectStartRunner(sandbox.path), ['pre-commit'], { hasLfsFiles: false })[0]!;
        const path = join(sandbox.path, 'pre-commit');
        await writeFile(path, hook.content);
        const searchPath = join(sandbox.path, "empty 'quoted' $(untouched)");
        const result = await runCommand(
            [Bun.which('sh')!, '-c', 'PATH=$1; export PATH; . "$2"', '--', searchPath, path],
            {
                cwd: sandbox.path,
                stdin: '',
            },
        );
        expect(result.code, result.stdout + result.stderr).toBe(2);
        expect(result.stderr).toBe(
            `${program} is not on the PATH that this Git client gives hooks (${searchPath}). Start the client from a terminal, or add ${program}'s folder to its PATH.\n`,
        );
    },
);

test.each(START_COMMANDS.filter(([program]) => program !== 'mise'))(
    'a %s hook with no gspot in the project names the installation steps before it starts a global gspot',
    async (program, packageManager) => {
        await using sandbox = await createGitSandbox({
            'package.json': JSON.stringify({ packageManager, devDependencies: { '@gspothq/cli': '0.0.0-test' } }),
        });
        const hook = buildHookFiles(selectStartRunner(sandbox.path), ['pre-commit'], { hasLfsFiles: false })[0]!;
        const path = join(sandbox.path, 'pre-commit');
        await writeFile(path, hook.content);
        const log = join(sandbox.path, 'calls.jsonl');
        const bin = await writeProgramCommand(sandbox.path, `bin/${program}`, 'fakes/tool', '--record', log);
        const result = await runCommand([Bun.which('sh')!, path], {
            cwd: sandbox.path,
            env: { PATH: bin },
            stdin: '',
        });
        expect(result.code, result.stdout + result.stderr).toBe(2);
        const name = program === 'bunx' ? 'bun' : program;
        expect(result.stderr).toBe(
            `gspot is not installed in this worktree. Run ${name} install, then gspot install.\n`,
        );
        expect(existsSync(log)).toBe(false);
    },
);

test('with Git LFS, the pre-push hook gives its input to gspot and then to git lfs, and the other LFS hooks run git lfs', async () => {
    await using sandbox = await createLfsRepository();
    const hooks = buildGeneratedFiles(await openSession(sandbox.path)).files.filter((file) =>
        file.path.startsWith(`${GSPOT_PATHS.hooks}/`),
    );
    expect(hooks.map((file) => file.path)).toStrictEqual(
        ['commit-msg', 'post-checkout', 'post-commit', 'post-merge', 'pre-commit', 'pre-push'].map(
            (name) => `${GSPOT_PATHS.hooks}/${name}`,
        ),
    );
    const log = join(sandbox.path, 'calls.jsonl');
    const recorder = ['--record', log, '--stdin', '--'];
    const bin = await writeProgramCommand(sandbox.path, 'bin/git', 'fakes/tool', ...recorder, 'git');
    await writeProgramCommand(sandbox.path, 'bin/git-lfs', 'fakes/tool', ...recorder, 'git-lfs');
    await writeProgramCommand(sandbox.path, 'bin/mise', 'fakes/tool', ...recorder, 'mise');
    await writeProgramCommand(sandbox.path, 'bin/cat', 'fakes/tool', '--copy-stdin');
    const environment = { PATH: bin };
    for (const hook of hooks) {
        const path = join(sandbox.path, hook.path);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, hook.content);
        await chmod(path, 0o755);
    }
    const hookRunner = isWindows ? [Bun.which('sh')!] : [];

    const pushHook = join(sandbox.path, GSPOT_PATHS.hooks, 'pre-push');
    const checkoutHook = join(sandbox.path, GSPOT_PATHS.hooks, 'post-checkout');
    const input = 'refs/heads/main 123 refs/heads/main 456\n';
    const pushed = await runCommand([...hookRunner, pushHook, 'origin', 'url'], {
        cwd: sandbox.path,
        env: environment,
        stdin: input,
    });
    expect(pushed.code, pushed.stdout + pushed.stderr).toBe(0);
    const checkedOut = await runCommand([...hookRunner, checkoutHook, 'a', 'b', '1'], {
        cwd: sandbox.path,
        env: environment,
        stdin: '',
    });
    expect(checkedOut.code, checkedOut.stdout + checkedOut.stderr).toBe(0);
    expect(await readCallRecords(log)).toMatchObject([
        {
            arguments: ['mise', 'exec', '--', 'gspot', 'check', '--hook', 'pre-push', '--', 'origin', 'url'],
            stdin: input,
        },
        { arguments: ['git', 'lfs', 'pre-push', 'origin', 'url'], stdin: input },
        { arguments: ['git', 'lfs', 'post-checkout', 'a', 'b', '1'], stdin: '' },
    ]);
});

test('with Git LFS, a pre-push hook whose checks fail uploads nothing', async () => {
    await using sandbox = await createLfsRepository();
    const hook = buildGeneratedFiles(await openSession(sandbox.path)).files.find(
        (file) => file.path === `${GSPOT_PATHS.hooks}/pre-push`,
    )!;
    const path = join(sandbox.path, hook.path);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, hook.content);
    await chmod(path, 0o755);
    const log = join(sandbox.path, 'calls.jsonl');
    const recorder = ['--record', log, '--stdin'];
    const bin = await writeProgramCommand(sandbox.path, 'bin/git-lfs', 'fakes/tool', ...recorder, '--', 'git-lfs');
    await writeProgramCommand(sandbox.path, 'bin/git', 'fakes/tool', ...recorder, '--', 'git');
    await writeProgramCommand(sandbox.path, 'bin/mise', 'fakes/tool', ...recorder, '--exit', '1', '--', 'mise');
    await writeProgramCommand(sandbox.path, 'bin/cat', 'fakes/tool', '--copy-stdin');
    const hookRunner = isWindows ? [Bun.which('sh')!] : [];
    const pushed = await runCommand([...hookRunner, path, 'origin', 'url'], {
        cwd: sandbox.path,
        env: { PATH: bin },
        stdin: 'refs/heads/main 123 refs/heads/main 456\n',
    });
    expect(pushed.code, pushed.stdout + pushed.stderr).toBe(1);
    const calls = await readCallRecords(log);
    expect(calls.map(({ arguments: called }) => called[0])).toStrictEqual(['mise']);
});

test.each(['pre-push', 'post-merge'])('%s exits before reading input when git-lfs is absent', async (name) => {
    await using sandbox = await testdir();
    const hook = buildHookFiles(selectStartRunner(sandbox.path), ['pre-push'], { hasLfsFiles: true }).find(({ path }) =>
        path.endsWith(`/${name}`),
    )!;
    await createFileTree(sandbox.path, { [hook.path]: hook.content });
    const path = join(sandbox.path, hook.path);
    await chmod(path, 0o755);
    const readMarker = join(sandbox.path, 'read-input');
    const bin = await writeProgramCommand(sandbox.path, 'bin/cat', 'fakes/tool', '--mark', readMarker);
    const command = isWindows ? [Bun.which('sh')!, path, '0'] : [path, '0'];
    const missing = await runCommand(command, {
        cwd: sandbox.path,
        env: { PATH: bin },
        stdin: '',
    });
    expect(existsSync(readMarker)).toBe(false);
    expect(missing.code, missing.stdout + missing.stderr).toBe(2);
    expect(missing.stderr).toBe(
        'This repository uses Git LFS. Install git-lfs, then run git lfs install --skip-repo.\n',
    );
});
