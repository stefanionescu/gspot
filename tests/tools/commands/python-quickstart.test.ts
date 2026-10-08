// Replay the tutorial through native bootstrap, setup, checks, and Git hooks.
import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { mkdir } from 'node:fs/promises';
import { openRoot } from '#cli/platform/root/open.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import { prepareQuickstart } from '#tests/harness/quickstart.ts';
import { git, commitAll, gitOutput } from '#tests/harness/git.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { SETUP_COMMANDS } from '#tests/config/samples/quickstart.ts';
import { INITIALIZE, INVALID_SOURCE, PROJECT_COMMANDS } from '#tests/config/tools/commands/python-quickstart.ts';

test('the Python tutorial reports its finding through the installed hook and passes after the fix', async () => {
    await using sandbox = await testdir();
    const root = join(sandbox.path, 'orders-python');
    await mkdir(root);
    await using prepared = await prepareQuickstart(root);
    const environment = prepared.environment;
    for (const command of PROJECT_COMMANDS)
        expect(
            await runTestCommand(command, { cwd: root, env: { ...environmentVariables(), ...environment } }),
        ).toMatchObject({ code: 0 });

    commitAll(root);
    expect(
        await runTestCommand(['mise', 'exec', `npm:@gspothq/cli@${packageManifest.version}`, '--', ...INITIALIZE], {
            cwd: root,
            env: environment,
        }),
    ).toMatchObject({ code: 0 });
    for (const { command, code } of SETUP_COMMANDS) {
        const result = await runTestCommand(command, { cwd: root, env: environment });
        expect(result.code, result.stdout + result.stderr).toBe(code);
    }

    using files = openRoot(root);
    const source = 'src/orders_python/__init__.py';
    const original = files.read(source)!;
    gitOutput(root, ['add', '-A']);
    expect(git(root, ['commit', '-qm', 'chore: Set up gspot'], environment)).toMatchObject({ code: 0 });
    files.write(source, { bytes: Buffer.from(INVALID_SOURCE), mode: original.mode }, original);
    const rejected = await runTestCommand(['mise', 'exec', '--', 'gspot', 'check', '--only', 'python/ruff'], {
        cwd: root,
        env: environment,
    });
    expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
    expect(rejected.stdout).toContain(
        'src/orders_python/__init__.py:3:1  invalid-syntax  unexpected EOF while parsing',
    );
    gitOutput(root, ['add', '-A']);
    const refused = git(root, ['commit', '-qm', 'feat: Add invalid source'], environment);
    expect(refused.code).not.toBe(0);
    expect(refused.stdout + refused.stderr).toContain('invalid-syntax');
    gitOutput(root, ['restore', '--source=HEAD', '--staged', '--worktree', '--', 'src/orders_python/__init__.py']);
    const restored = files.read(source)!;
    expect(restored.bytes).toStrictEqual(original.bytes);
    expect(restored.mode).toBe(original.mode);
    const corrected = await runTestCommand(['mise', 'exec', '--', 'gspot', 'check', '--only', 'python/ruff'], {
        cwd: root,
        env: environment,
    });
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});
