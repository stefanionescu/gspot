import cliPackage from '#cli-package';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { join, dirname, delimiter } from 'node:path';
import { generate } from '#cli/generation/generate.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { buildHookFiles } from '#cli/generation/hooks.ts';
import { HOOKS_SETTINGS } from '#tests/config/setup/cli.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { writeProgramCommand } from '#tests/setup/system/fakes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { selectStartRunner } from '#cli/repository/npm/package-manager.ts';
import { createLfsRepository } from '#tests/setup/sandboxes/repositories.ts';
import { chmod, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { HOOK_CASES, START_COMMANDS, HOOK_LEVEL_CASES } from '#tests/config/generation/hooks.ts';

test.each([...HOOK_LEVEL_CASES])(
    'at level $level, gspot writes check hooks and guarded Git LFS hooks',
    async ({ level, hooks }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings([], { level, tables: HOOKS_SETTINGS }),
        });
        runGitStep(sandbox.path, ['init', '-q']);
        const written = generate(await openSession(sandbox.path)).files.filter((file) =>
            file.path.startsWith(`${GSPOT_PATHS.hooks}/`),
        );
        expect(written.map((file) => file.path)).toStrictEqual(hooks.map((name) => `${GSPOT_PATHS.hooks}/${name}`));
    },
);

test.each(
    START_COMMANDS.flatMap(([program, packageManager, prefix]) =>
        [
            { place: 'the Git top level', folder: '' },
            { place: 'a folder below it', folder: 'project' },
        ].map((place) => ({ program, packageManager, prefix, ...place })),
    ),
)(
    'each hook script uses the $program start command to run one check, with gspot.toml at $place',
    async ({ program, packageManager, prefix, folder }) => {
        await using sandbox = await testdir({
            [join(folder, 'gspot.toml')]: buildSandboxSettings([], { rules: true }),
        });

        runGitStep(sandbox.path, ['init', '-q']);
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
            false,
        );
        expect(files.map((file) => file.path)).toStrictEqual(
            HOOK_CASES.map(([name]) => `${GSPOT_PATHS.hooks}/${name}`),
        );
        await writeProgramCommand(
            sandbox.path,
            `bin/${program}`,
            'processes/call',
            '--environment',
            'GSPOT_HOOK',
            '--',
        );
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
            const suffix =
                name === 'commit-msg' ? [join(await realpath(sandbox.path), 'message')] : [...commandArguments];
            expect(JSON.parse(result.stderr)).toStrictEqual({
                arguments: [...prefix, 'check', '--hook', name, ...(name === 'pre-commit' ? [] : ['--']), ...suffix],
                environment: { GSPOT_HOOK: null },
                cwd,
            });
        }
    },
);

test('a hook says how to install mise when mise is missing', async () => {
    await using sandbox = await testdir();
    runGitStep(sandbox.path, ['init', '-q']);
    const hook = buildHookFiles(
        selectStartRunner(sandbox.path),
        HOOK_CASES.map(([name]) => name),
        false,
    ).find((file) => file.path.endsWith('pre-push'))!;
    const path = join(sandbox.path, 'pre-push');
    await writeFile(path, hook.content);
    await chmod(path, 0o755);
    const shExecutable = Bun.which('sh')!;
    const result = await runCommand([shExecutable, path, 'origin', 'https://example.com/repository.git'], {
        cwd: sandbox.path,
        env: { PATH: join(sandbox.path, 'empty') },
        stdin: 'refs/heads/main 123 refs/heads/main 456\n',
    });
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(result.stderr).toBe(
        `mise is not installed. Install mise, then run: mise install. Install gspot with: mise use --pin --tool-option allow_low_downloads=true npm:@gspothq/cli@${cliPackage.version}\n`,
    );
});

test('with Git LFS, the pre-push hook gives its input to git lfs and to gspot, and the other LFS hooks run git lfs', async () => {
    await using sandbox = await createLfsRepository();
    const hooks = generate(await openSession(sandbox.path)).files.filter((file) =>
        file.path.startsWith(`${GSPOT_PATHS.hooks}/`),
    );
    expect(hooks.map((file) => file.path)).toStrictEqual(
        ['post-checkout', 'post-commit', 'post-merge', 'pre-commit', 'pre-push'].map(
            (name) => `${GSPOT_PATHS.hooks}/${name}`,
        ),
    );
    const bin = await writeProgramCommand(sandbox.path, 'bin/git', 'fakes/logger', 'git');
    await writeProgramCommand(sandbox.path, 'bin/git-lfs', 'fakes/logger', 'git-lfs');
    await writeProgramCommand(sandbox.path, 'bin/mise', 'fakes/logger', 'mise');
    await writeProgramCommand(sandbox.path, 'bin/cat', 'fakes/tool', '--copy-stdin');
    const log = join(sandbox.path, 'calls.jsonl');
    const environment = { PATH: bin, CALLS_LOG: log };
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
    const logged = await readFile(log, 'utf8');
    const calls = logged
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as unknown);
    expect(calls).toStrictEqual([
        { name: 'git', argv: ['lfs', 'pre-push', 'origin', 'url'], input },
        { name: 'mise', argv: ['exec', '--', 'gspot', 'check', '--hook', 'pre-push', '--', 'origin', 'url'], input },
        { name: 'git', argv: ['lfs', 'post-checkout', 'a', 'b', '1'], input: '' },
    ]);
});

test('an LFS hook passes when git-lfs is absent', async () => {
    await using sandbox = await testdir();
    const hook = buildHookFiles(selectStartRunner(sandbox.path), [], true).find(({ path }) =>
        path.endsWith('/post-merge'),
    )!;
    await createFileTree(sandbox.path, { [hook.path]: hook.content });
    const path = join(sandbox.path, hook.path);
    await chmod(path, 0o755);
    const command = isWindows ? [Bun.which('sh')!, path, '0'] : [path, '0'];
    const missing = await runCommand(command, {
        cwd: sandbox.path,
        env: { PATH: join(sandbox.path, 'empty') },
        stdin: '',
    });
    expect(missing.code, missing.stdout + missing.stderr).toBe(0);
});
