import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { gitOutput } from '#tests/setup/git.ts';
import { chmod, realpath } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { fakeTool } from '#tests/setup/fake-tool.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { runCommand } from '#tests/setup/processes.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { hookFiles, startRunner } from '#cli/generation/hooks.ts';
import { HOOK_CASES, HOOK_PROGRAM, START_COMMANDS } from '#tests/config/hooks.ts';
import { environmentVariable, buildSpawnEnvironment } from '#cli/system/environment.ts';

test('a repository at the Git top level gets hooks that change no folder', async () => {
    await using sandbox = await testdir();
    gitOutput(sandbox.path, ['init', '-q']);
    const settings = parseSettings(settingsText([], { rules: true, tables: '[hooks]\nenabled = true\n' }));
    const files = hookFiles(sandbox.path, settings, await startRunner(sandbox.path));
    expect(files).toHaveLength(3);
    for (const file of files) expect(file.content).not.toContain('\ncd ');
});

test.each(START_COMMANDS)(
    'each hook script uses the %s start command to run one check',
    async (program, npmClient, prefix) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { "app's dir/gspot.toml": 'configurations = []\n' });
        gitOutput(sandbox.path, ['init', '-q']);
        const root = join(sandbox.path, "app's dir");
        if (npmClient !== undefined)
            await Bun.write(
                join(root, 'package.json'),
                JSON.stringify({
                    packageManager: npmClient,
                    devDependencies: { '@gspothq/cli': '1.2.3' },
                }),
            );
        const settings = parseSettings(settingsText([], { rules: true, tables: '[hooks]\nenabled = true\n' }));
        const files = hookFiles(root, settings, await startRunner(root));
        expect(files.map((file) => file.path)).toStrictEqual(HOOK_CASES.map(([name]) => `.gspot/hooks/${name}`));
        await fakeTool(sandbox.path, `bin/${program}`, HOOK_PROGRAM);
        const cwd = await realpath(join(sandbox.path, "app's dir"));
        for (const [index, [name, argv]] of HOOK_CASES.entries()) {
            const file = files[index]!;
            expect(file).toMatchObject({ executable: true, kind: 'hook' });
            const path = join(sandbox.path, name);
            await Bun.write(path, file.content);
            await chmod(path, 0o755);
            const result = await runCommand(
                ['git', '-c', `core.hooksPath=${sandbox.path}`, 'hook', 'run', name, '--', ...argv],
                {
                    cwd: sandbox.path,
                    env: {
                        PATH: `${join(sandbox.path, 'bin')}${delimiter}${environmentVariable(buildSpawnEnvironment(), 'PATH') ?? ''}`,
                    },
                },
            );
            expect(result.code, result.stdout + result.stderr).toBe(0);
            const suffix =
                name === 'commit-msg' ? ['--message-file', join(await realpath(sandbox.path), 'message')] : [...argv];
            expect(JSON.parse(result.stderr)).toStrictEqual({
                argv: [
                    ...prefix,
                    'check',
                    ...(name === 'commit-msg' ? [] : ['--hook', name]),
                    ...(name === 'pre-push' ? ['--'] : []),
                    ...suffix,
                ],
                cwd,
                hook: null,
            });
        }
    },
);

test('a hook says how to install mise when mise is missing', async () => {
    await using sandbox = await testdir();
    gitOutput(sandbox.path, ['init', '-q']);
    const settings = parseSettings(settingsText([], { rules: true, tables: '[hooks]\nenabled = true\n' }));
    const hook = hookFiles(sandbox.path, settings, await startRunner(sandbox.path)).find((file) =>
        file.path.endsWith('pre-push'),
    )!;
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
