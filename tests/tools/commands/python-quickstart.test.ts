// Replay the tutorial through native bootstrap, setup, checks, and Git hooks.
import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runTestCommand } from '#tests/harness/command.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import { prepareQuickstart } from '#tests/harness/quickstart.ts';
import { git, commitAll, gitOutput } from '#tests/harness/git.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { stat, mkdir, readFile, writeFile } from 'node:fs/promises';
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

    const source = join(root, 'src/orders_python/__init__.py');
    const original = await readFile(source, 'utf8');
    const { mode } = await stat(source);
    gitOutput(root, ['add', '-A']);
    expect(git(root, ['commit', '-qm', 'chore: Set up gspot'], environment)).toMatchObject({ code: 0 });
    await writeFile(source, INVALID_SOURCE);
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
    expect(await readFile(source, 'utf8')).toBe(original);
    expect(await stat(source)).toMatchObject({ mode });
    const corrected = await runTestCommand(['mise', 'exec', '--', 'gspot', 'check', '--only', 'python/ruff'], {
        cwd: root,
        env: environment,
    });
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});
