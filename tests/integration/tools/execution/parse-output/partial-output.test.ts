import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { openSession } from '#cli/execution/session.ts';
import { planRun } from '#cli/execution/planning/plan.ts';
import { containing } from '#tests/support/expectations.ts';
import { checkedFindings } from '#cli/execution/broken-tool.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import type { PlannedCheck } from '#cli/types/execution/execution.ts';
import { PYTHON_ENVIRONMENT_DIRECTORY } from '#cli/config/platform.ts';
import { ToolOutputError } from '#cli/execution/output/tool-formats.ts';
import { toolsPath, installPrivateTools } from '#tests/support/cli/tools.ts';
import { INSTALL_TIMEOUT_MS } from '#tests/config/integration/tools/tools.ts';

test('ShellCheck rejects partial findings when another selected file cannot be read', async () => {
    await using sandbox = await testdir();
    const source = '#!/usr/bin/env bash\necho $unquoted\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nkits = ["bash"]\n',
        'sample.sh': source,
    });
    const session = await openSession(sandbox.path);
    const plans = planRun(session, { stage: 'commit', skips: [], only: ['bash/shellcheck'] });
    const planned = plans[0]!;
    const command = ['shellcheck', '--norc', '--format=gcc', 'sample.sh'];
    const roots: [string, string] = [sandbox.path, sandbox.path];
    const broken = Bun.spawnSync([...command, 'missing.sh'], { cwd: sandbox.path });
    expect(broken.exitCode, broken.stderr.toString()).toBe(2);
    expect(broken.stdout.toString()).toContain('SC2086');
    const result = {
        code: broken.exitCode,
        stdout: broken.stdout.toString(),
        stderr: broken.stderr.toString(),
        missing: false,
        duration: 1,
    };
    expect(() => checkedFindings(planned, result, roots)).toThrow(ToolOutputError);
    const defect = Bun.spawnSync(command, { cwd: sandbox.path });
    expect(defect.exitCode).toBe(1);
    expect(
        checkedFindings(
            planned,
            { ...result, code: defect.exitCode, stdout: defect.stdout.toString(), stderr: defect.stderr.toString() },
            roots,
        ),
    ).toContainEqual(containing({ file: 'sample.sh', line: 2, rule: 'SC2086' }));
    expect(await Bun.file(join(sandbox.path, 'sample.sh')).text()).toBe(source);
    await Bun.write(join(sandbox.path, 'sample.sh'), '#!/usr/bin/env bash\nprintf "%s\\n" "${1:-}"\n');
    const corrected = Bun.spawnSync(command, { cwd: sandbox.path });
    expect(corrected.exitCode).toBe(0);
    expect(
        checkedFindings(
            planned,
            {
                ...result,
                code: corrected.exitCode,
                stdout: corrected.stdout.toString(),
                stderr: corrected.stderr.toString(),
            },
            roots,
        ),
    ).toStrictEqual([]);
});

// The plan for the vulture check of a sandbox, and the environment that reaches the vulture gspot installed for it.
async function preparedVulture(root: string): Promise<{ planned: PlannedCheck; env: Record<string, string> }> {
    // The tool comes from the installation gspot makes for the sandbox, which no runner puts on PATH.
    const applied = await run(root, ['apply']);
    if (applied.code !== 0) throw new Error(`The sandbox apply failed: ${applied.stdout}${applied.stderr}`);
    await installPrivateTools(root);
    const session = await openSession(root);
    const plans = planRun(session, { stage: 'push', skips: [], only: ['python/vulture'] });
    const bin = join(root, PYTHON_ENVIRONMENT_DIRECTORY, process.platform === 'win32' ? 'Scripts' : 'bin');
    return { planned: plans[0]!, env: { ...environmentVariables(), PATH: [bin, toolsPath([])].join(delimiter) } };
}

test.each(['def broken(:\n', 'value = "\u0000"\n'])(
    'Vulture rejects incomplete analysis of %j even when dead-code findings set exit 3',
    async (brokenSource) => {
        await using sandbox = await testdir();
        const source = 'import os\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nlevel = "all"\nkits = ["python"]\n',
            'sample.py': source,
            'broken.py': brokenSource,
        });
        const { planned, env } = await preparedVulture(sandbox.path);
        const command = ['vulture', '--min-confidence', '80', 'sample.py', 'broken.py'];
        const roots: [string, string] = [sandbox.path, sandbox.path];
        const broken = Bun.spawnSync(command, { cwd: sandbox.path, env });
        expect(broken.exitCode, broken.stderr.toString()).toBe(3);
        expect(broken.stdout.toString()).toContain("unused import 'os'");
        const result = {
            code: broken.exitCode,
            stdout: broken.stdout.toString(),
            stderr: broken.stderr.toString(),
            missing: false,
            duration: 1,
        };
        expect(() => checkedFindings(planned, result, roots)).toThrow(ToolOutputError);
        expect(await Bun.file(join(sandbox.path, 'broken.py')).text()).toBe(brokenSource);
        await Bun.write(join(sandbox.path, 'broken.py'), 'print("Ready")\n');
        const defect = Bun.spawnSync(command, { cwd: sandbox.path, env });
        expect(defect.exitCode).toBe(3);
        expect(
            checkedFindings(
                planned,
                {
                    ...result,
                    code: defect.exitCode,
                    stdout: defect.stdout.toString(),
                    stderr: defect.stderr.toString(),
                },
                roots,
            ),
        ).toContainEqual(containing({ file: 'sample.py', line: 1, message: "unused import 'os' (90% confidence)" }));
        expect(await Bun.file(join(sandbox.path, 'sample.py')).text()).toBe(source);
        await Bun.write(join(sandbox.path, 'sample.py'), 'print("Ready")\n');
        const corrected = Bun.spawnSync(command, { cwd: sandbox.path, env });
        expect(corrected.exitCode).toBe(0);
        expect(
            checkedFindings(
                planned,
                {
                    ...result,
                    code: corrected.exitCode,
                    stdout: corrected.stdout.toString(),
                    stderr: corrected.stderr.toString(),
                },
                roots,
            ),
        ).toStrictEqual([]);
    },
    INSTALL_TIMEOUT_MS,
);
