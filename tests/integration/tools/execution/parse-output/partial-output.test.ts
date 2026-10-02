import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { openSession } from '#cli/execution/session.ts';
import { planRun } from '#cli/execution/planning/plan.ts';
import { containing } from '#tests/support/expectations.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';
import { checkedFindings } from '#cli/execution/tool/findings.ts';
import { PYTHON_ENVIRONMENT_DIRECTORY } from '#cli/config/kits.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import type { PlannedCheck } from '#cli/types/execution/execution.ts';
import { toolsPath, installPrivateTools } from '#tests/support/cli/tools.ts';
import { INSTALL_TIMEOUT_MS } from '#tests/inputs/integration/tools/tools.ts';

test('ShellCheck rejects partial findings when another selected file cannot be read', async () => {
    await using sandbox = await testdir();
    const source = '#!/usr/bin/env bash\necho $unquoted\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(['bash']),
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
    expect(() => checkedFindings(planned, result, roots)).toThrow(GspotError);
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

test(
    'Vulture rejects incomplete analysis even when dead-code findings set exit 3',
    async () => {
        await using sandbox = await testdir();
        const source = 'import os\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': policyOf(['python'], '', 'all'),
            'sample.py': source,
            'broken.py': 'print("Ready")\n',
        });
        const { planned, env } = await preparedVulture(sandbox.path);
        const command = ['vulture', '--min-confidence', '80', 'sample.py', 'broken.py'];
        const roots: [string, string] = [sandbox.path, sandbox.path];
        const exit = { missing: false, duration: 1 };
        for (const brokenSource of ['def broken(:\n', 'value = "\u0000"\n']) {
            await Bun.write(join(sandbox.path, 'broken.py'), brokenSource);
            const broken = Bun.spawnSync(command, { cwd: sandbox.path, env });
            expect(broken.exitCode, broken.stderr.toString()).toBe(3);
            expect(broken.stdout.toString()).toContain("unused import 'os'");
            const result = {
                ...exit,
                code: broken.exitCode,
                stdout: broken.stdout.toString(),
                stderr: broken.stderr.toString(),
            };
            expect(() => checkedFindings(planned, result, roots)).toThrow(GspotError);
            expect(await Bun.file(join(sandbox.path, 'broken.py')).text()).toBe(brokenSource);
        }
        await Bun.write(join(sandbox.path, 'broken.py'), 'print("Ready")\n');
        const defect = Bun.spawnSync(command, { cwd: sandbox.path, env });
        expect(defect.exitCode).toBe(3);
        const found = {
            ...exit,
            code: defect.exitCode,
            stdout: defect.stdout.toString(),
            stderr: defect.stderr.toString(),
        };
        expect(checkedFindings(planned, found, roots)).toContainEqual(
            containing({ file: 'sample.py', line: 1, message: "unused import 'os' (90% confidence)" }),
        );
        expect(await Bun.file(join(sandbox.path, 'sample.py')).text()).toBe(source);
        await Bun.write(join(sandbox.path, 'sample.py'), 'print("Ready")\n');
        const corrected = Bun.spawnSync(command, { cwd: sandbox.path, env });
        expect(corrected.exitCode).toBe(0);
        const clean = {
            ...exit,
            code: corrected.exitCode,
            stdout: corrected.stdout.toString(),
            stderr: corrected.stderr.toString(),
        };
        expect(checkedFindings(planned, clean, roots)).toStrictEqual([]);
    },
    INSTALL_TIMEOUT_MS,
);
