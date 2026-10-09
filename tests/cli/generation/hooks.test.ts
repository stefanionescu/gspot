// The hook scripts: one per stage, each a shell script that enters the gspot root and runs one check.
import { test, expect } from 'bun:test';
import { realpath } from 'node:fs/promises';
import { join, delimiter } from 'node:path';
import { gitOutput } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { fakeTool } from '#tests/harness/platforms.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { hookFiles } from '#cli/generation/contracts.ts';
import { parseStrictPolicy } from '#cli/policy/public.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { environmentVariables } from '#cli/platform/public.ts';
import { HOOK_CASES, RUNNER_CASES, HOOK_PROGRAM } from '#tests/config/cli/generation/hooks.ts';

test.each(RUNNER_CASES)(
    'the hook scripts under the %s runner run one check with the selected runner and repository inputs',
    async (_label, runner, prefix) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { "app's dir/gspot.toml": 'configurations = []\n' });
        gitOutput(sandbox.path, ['init', '-q']);
        const tables =
            runner === undefined ? '[hooks]\nenabled = true\n' : `runner = "${runner}"\n[hooks]\nenabled = true\n`;
        const policy = parseStrictPolicy(buildPolicy([], { agentRules: true, tables: tables }));
        const files = hookFiles(join(sandbox.path, "app's dir"), policy, '1.2.3');
        expect(files.map((file) => file.path)).toStrictEqual(HOOK_CASES.map(([name]) => `.gspot/hooks/${name}`));
        for (const tool of ['gspot', 'npm', 'mise']) await fakeTool(sandbox.path, `bin/${tool}`, HOOK_PROGRAM);
        const cwd = await realpath(join(sandbox.path, "app's dir"));
        for (const [index, [name, argv]] of HOOK_CASES.entries()) {
            const file = files[index]!;
            expect(file).toMatchObject({ executable: true, kind: 'hook' });
            const path = join(sandbox.path, name);
            await Bun.write(path, file.content);
            const result = await runTestCommand(['sh', path, ...argv], {
                cwd: sandbox.path,
                env: { PATH: `${join(sandbox.path, 'bin')}${delimiter}${environmentVariables()['PATH'] ?? ''}` },
            });
            expect(result.code, result.stdout + result.stderr).toBe(0);
            const suffix =
                name === 'commit-msg' ? ['--message-file', join(await realpath(sandbox.path), 'message')] : [...argv];
            expect(JSON.parse(result.stdout)).toStrictEqual({
                argv: [...prefix, 'check', '--hook', name, ...(name === 'pre-push' ? ['--'] : []), ...suffix],
                cwd,
                hook: null,
            });
        }
    },
);

test('a repository at the Git top level enters no folder', async () => {
    await using sandbox = await testdir();
    gitOutput(sandbox.path, ['init', '-q']);
    const policy = parseStrictPolicy(buildPolicy([], { agentRules: true, tables: '[hooks]\nenabled = true\n' }));
    const files = hookFiles(sandbox.path, policy, '1.2.3');
    expect(files).toHaveLength(3);
    for (const file of files) expect(file.content).not.toContain('\ncd ');
});

test.skipIf(!isPosix)('a hook explains how to acquire a missing Mise runner', async () => {
    await using sandbox = await testdir();
    const policy = parseStrictPolicy(
        buildPolicy([], { agentRules: true, tables: 'runner = "mise"\n[hooks]\nenabled = true\n' }),
    );
    const hook = hookFiles(sandbox.path, policy, '1.2.3').find((file) => file.path.endsWith('pre-push'))!;
    const path = join(sandbox.path, 'pre-push');
    await Bun.write(path, hook.content);
    const result = await runTestCommand(['/bin/sh', path, 'origin', 'https://example.com/repository.git'], {
        cwd: sandbox.path,
        env: { PATH: '' },
        stdin: 'refs/heads/main 123 refs/heads/main 456\n',
    });
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(result.stderr).toContain('mise is not installed. Install mise, then run: mise install.');
});
