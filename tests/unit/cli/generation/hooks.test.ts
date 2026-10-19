import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { openSession } from '#cli/session.ts';
import { fakeTool } from '#tests/setup/fakes.ts';
import { chmod, realpath } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { parseSettings } from '#cli/settings/read.ts';
import { generate } from '#cli/generation/generate.ts';
import { runCommand } from '#tests/setup/processes.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import type { Settings } from '#cli/types/settings/values.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { selectRunner, buildHookFiles } from '#cli/generation/hooks.ts';
import { readGitOutput, createLfsRepository } from '#tests/setup/git.ts';
import { HOOK_CASES, HOOK_PROGRAM, START_COMMANDS, LOGGING_PROGRAM, HOOK_LEVEL_CASES } from '#tests/data/hooks.ts';

/** Build new settings with hooks on, for each script run. */
function buildHookSettings(): Settings {
    return parseSettings(
        buildSettingsText([], { rules: true, tables: '[hooks]\nenabled = true\n' }),
        undefined,
        createReadCache(process.cwd()),
    );
}

test('a repository at the Git top level gets hooks that change no folder', async () => {
    await using sandbox = await testdir();
    readGitOutput(sandbox.path, ['init', '-q']);
    const settings = buildHookSettings();
    const files = buildHookFiles(sandbox.path, settings, await selectRunner(sandbox.path), {
        names: HOOK_CASES.map(([name]) => name),
        usesLfs: false,
    });
    expect(files).toHaveLength(3);
    for (const file of files) expect(file.content).not.toContain('\ncd ');
});

test.each([...HOOK_LEVEL_CASES])(
    'at level $level, gspot writes a hook only for a stage with a check',
    async ({ level, hooks }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSettingsText([], { level, tables: '[hooks]\nenabled = true\n' }),
        });
        readGitOutput(sandbox.path, ['init', '-q']);
        const written = generate(await openSession(sandbox.path)).files.filter((file) => file.kind === 'hook');
        expect(written.map((file) => file.path)).toStrictEqual(hooks.map((name) => `.gspot/hooks/${name}`));
    },
);

test.each(START_COMMANDS)(
    'each hook script uses the %s start command to run one check',
    async (program, packageManager, prefix) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { "app's dir/gspot.toml": 'configurations = []\n' });
        readGitOutput(sandbox.path, ['init', '-q']);
        const root = join(sandbox.path, "app's dir");
        if (packageManager !== undefined)
            await Bun.write(
                join(root, 'package.json'),
                JSON.stringify({
                    packageManager: packageManager,
                    devDependencies: { '@gspothq/cli': '1.2.3' },
                }),
            );
        const settings = buildHookSettings();
        const files = buildHookFiles(root, settings, await selectRunner(root), {
            names: HOOK_CASES.map(([name]) => name),
            usesLfs: false,
        });
        expect(files.map((file) => file.path)).toStrictEqual(HOOK_CASES.map(([name]) => `.gspot/hooks/${name}`));
        await fakeTool(sandbox.path, `bin/${program}`, HOOK_PROGRAM);
        const cwd = await realpath(join(sandbox.path, "app's dir"));
        for (const [index, [name, commandArguments]] of HOOK_CASES.entries()) {
            const file = files[index]!;
            expect(file).toMatchObject({ executable: true, kind: 'hook' });
            const path = join(sandbox.path, name);
            await Bun.write(path, file.content);
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
                argv: [...prefix, 'check', '--hook', name, ...(name === 'pre-commit' ? [] : ['--']), ...suffix],
                cwd,
                hook: null,
            });
        }
    },
);

test('a hook says how to install mise when mise is missing', async () => {
    await using sandbox = await testdir();
    readGitOutput(sandbox.path, ['init', '-q']);
    const settings = buildHookSettings();
    const hook = buildHookFiles(sandbox.path, settings, await selectRunner(sandbox.path), {
        names: HOOK_CASES.map(([name]) => name),
        usesLfs: false,
    }).find((file) => file.path.endsWith('pre-push'))!;
    const path = join(sandbox.path, 'pre-push');
    await Bun.write(path, hook.content);
    await chmod(path, 0o755);
    const shExecutable = Bun.which('sh')!;
    const result = await runCommand([shExecutable, path, 'origin', 'https://example.com/repository.git'], {
        cwd: sandbox.path,
        env: { PATH: join(sandbox.path, 'empty') },
        stdin: 'refs/heads/main 123 refs/heads/main 456\n',
    });
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(result.stderr).toContain('mise is not installed. Install mise, then run: mise install.');
});

test('with Git LFS, the pre-push hook gives its input to git lfs and to gspot, and the other LFS hooks run git lfs', async () => {
    await using sandbox = await createLfsRepository();
    const hooks = generate(await openSession(sandbox.path)).files.filter((file) => file.kind === 'hook');
    expect(hooks.map((file) => file.path)).toStrictEqual(
        ['post-checkout', 'post-commit', 'post-merge', 'pre-commit', 'pre-push'].map((name) => `.gspot/hooks/${name}`),
    );
    const bin = await fakeTool(sandbox.path, 'bin/git-lfs', LOGGING_PROGRAM);
    await fakeTool(sandbox.path, 'bin/mise', LOGGING_PROGRAM);
    const log = join(sandbox.path, 'calls.jsonl');
    const environment = { PATH: `${bin}${delimiter}${readEnvironmentVariable('PATH') ?? ''}`, CALLS_LOG: log };
    for (const hook of hooks) {
        const path = join(sandbox.path, hook.path);
        await Bun.write(path, hook.content);
        await chmod(path, 0o755);
    }
    const shExecutable = Bun.which('sh')!;
    const input = 'refs/heads/main 123 refs/heads/main 456\n';
    const pushed = await runCommand([shExecutable, join(sandbox.path, '.gspot/hooks/pre-push'), 'origin', 'url'], {
        cwd: sandbox.path,
        env: environment,
        stdin: input,
    });
    expect(pushed.code, pushed.stdout + pushed.stderr).toBe(0);
    const checkedOut = await runCommand(
        [shExecutable, join(sandbox.path, '.gspot/hooks/post-checkout'), 'a', 'b', '1'],
        {
            cwd: sandbox.path,
            env: environment,
            stdin: '',
        },
    );
    expect(checkedOut.code, checkedOut.stdout + checkedOut.stderr).toBe(0);
    const logged = await Bun.file(log).text();
    const calls = logged
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as unknown);
    expect(calls).toStrictEqual([
        { name: 'git-lfs', argv: ['pre-push', 'origin', 'url'], input },
        { name: 'mise', argv: ['exec', '--', 'gspot', 'check', '--hook', 'pre-push', '--', 'origin', 'url'], input },
        { name: 'git-lfs', argv: ['post-checkout', 'a', 'b', '1'], input: '' },
    ]);
    const missing = await runCommand([shExecutable, join(sandbox.path, '.gspot/hooks/post-merge'), '0'], {
        cwd: sandbox.path,
        env: { PATH: join(sandbox.path, 'empty') },
        stdin: '',
    });
    expect(missing.code, missing.stdout + missing.stderr).toBe(0);
});
