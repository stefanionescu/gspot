import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { join, dirname, delimiter } from 'node:path';
import { parseSettings } from '#cli/settings/read.ts';
import { generate } from '#cli/generation/generate.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { buildHookFiles } from '#cli/generation/hooks.ts';
import { HOOKS_SETTINGS } from '#tests/data/setup/cli.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { writeScriptCommand } from '#tests/setup/system/fakes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { selectStartRunner } from '#cli/repository/npm/package-manager.ts';
import { createLfsRepository } from '#tests/setup/sandboxes/repositories.ts';
import { chmod, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';

import {
    CAT_SCRIPT,
    HOOK_CASES,
    HOOK_SCRIPT,
    LOGGING_SCRIPT,
    START_COMMANDS,
    HOOK_LEVEL_CASES,
} from '#tests/data/generation/hooks.ts';

test.each([...HOOK_LEVEL_CASES])(
    'at level $level, gspot writes a hook only for a stage with a check',
    async ({ level, hooks }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings([], { level, tables: HOOKS_SETTINGS }),
        });
        runGitStep(sandbox.path, ['init', '-q']);
        const written = generate(await openSession(sandbox.path)).files.filter((file) =>
            file.path.startsWith('.gspot/hooks/'),
        );
        expect(written.map((file) => file.path)).toStrictEqual(hooks.map((name) => `.gspot/hooks/${name}`));
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
        const settings = parseSettings(buildSandboxSettings([], { rules: true, tables: HOOKS_SETTINGS }), undefined);
        const files = buildHookFiles(settings, await selectStartRunner(root), {
            names: HOOK_CASES.map(([name]) => name),
            usesLfs: false,
        });
        expect(files.map((file) => file.path)).toStrictEqual(HOOK_CASES.map(([name]) => `.gspot/hooks/${name}`));
        await writeScriptCommand(sandbox.path, `bin/${program}`, HOOK_SCRIPT);
        // Git runs each hook in its top-level folder, wherever gspot.toml lives.
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
                argv: [...prefix, 'check', '--hook', name, ...(name === 'pre-commit' ? [] : ['--']), ...suffix],
                cwd,
                hook: null,
            });
        }
    },
);

test('a hook says how to install mise when mise is missing', async () => {
    await using sandbox = await testdir();
    runGitStep(sandbox.path, ['init', '-q']);
    const settings = parseSettings(buildSandboxSettings([], { rules: true, tables: HOOKS_SETTINGS }), undefined);
    const hook = buildHookFiles(settings, await selectStartRunner(sandbox.path), {
        names: HOOK_CASES.map(([name]) => name),
        usesLfs: false,
    }).find((file) => file.path.endsWith('pre-push'))!;
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
    expect(result.stderr).toContain('mise is not installed. Install mise, then run: mise install.');
});

test('with Git LFS, the pre-push hook gives its input to git lfs and to gspot, and the other LFS hooks run git lfs', async () => {
    await using sandbox = await createLfsRepository();
    const hooks = generate(await openSession(sandbox.path)).files.filter((file) =>
        file.path.startsWith('.gspot/hooks/'),
    );
    expect(hooks.map((file) => file.path)).toStrictEqual(
        ['post-checkout', 'post-commit', 'post-merge', 'pre-commit', 'pre-push'].map((name) => `.gspot/hooks/${name}`),
    );
    const bin = await writeScriptCommand(sandbox.path, 'bin/git', LOGGING_SCRIPT);
    await writeScriptCommand(sandbox.path, 'bin/git-lfs', LOGGING_SCRIPT);
    await writeScriptCommand(sandbox.path, 'bin/mise', LOGGING_SCRIPT);
    await writeScriptCommand(sandbox.path, 'bin/cat', CAT_SCRIPT);
    const log = join(sandbox.path, 'calls.jsonl');
    const environment = { PATH: bin, CALLS_LOG: log };
    for (const hook of hooks) {
        const path = join(sandbox.path, hook.path);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, hook.content);
        await chmod(path, 0o755);
    }
    // The process runner puts the folder of an absolute program first on the search path, so /usr/bin/sh brings
    // /usr/bin/git ahead of the fakes. Each hook runs by its own path; Windows runs it through the sh of Git for Windows,
    // whose folder holds no git.
    const shExecutable = Bun.which('sh')!;
    const runHook = (name: string, ...hookArguments: string[]): string[] => {
        const path = join(sandbox.path, '.gspot/hooks', name);
        return isWindows ? [shExecutable, path, ...hookArguments] : [path, ...hookArguments];
    };
    const input = 'refs/heads/main 123 refs/heads/main 456\n';
    const pushed = await runCommand(runHook('pre-push', 'origin', 'url'), {
        cwd: sandbox.path,
        env: environment,
        stdin: input,
    });
    expect(pushed.code, pushed.stdout + pushed.stderr).toBe(0);
    const checkedOut = await runCommand(runHook('post-checkout', 'a', 'b', '1'), {
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
    const missing = await runCommand(runHook('post-merge', '0'), {
        cwd: sandbox.path,
        env: { PATH: join(sandbox.path, 'empty') },
        stdin: '',
    });
    expect(missing.code, missing.stdout + missing.stderr).toBe(0);
});
