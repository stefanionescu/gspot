import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { fakeTool } from '#tests/setup/fakes.ts';
import { chmod, realpath } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { readGitOutput } from '#tests/setup/git.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { runCommand } from '#tests/setup/processes.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import type { Settings } from '#cli/types/settings/values.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { selectRunner, buildHookFiles } from '#cli/generation/hooks.ts';
import { HOOK_CASES, HOOK_PROGRAM, START_COMMANDS } from '#tests/data/hooks.ts';

/** Build independent hook-enabled settings for each script execution. */
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
    const files = buildHookFiles(sandbox.path, settings, await selectRunner(sandbox.path));
    expect(files).toHaveLength(3);
    for (const file of files) expect(file.content).not.toContain('\ncd ');
});

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
        const files = buildHookFiles(root, settings, await selectRunner(root));
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
    const hook = buildHookFiles(sandbox.path, settings, await selectRunner(sandbox.path)).find((file) =>
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
