import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { GspotError } from '#cli/platform/errors.ts';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { environmentBin } from '#cli/platform/paths.ts';
import { openSession } from '#cli/execution/session.ts';
import { planRun } from '#cli/execution/planning/plan.ts';
import { checkedFindings } from '#cli/execution/output.ts';
import { containing } from '#tests/harness/expectations.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { runTestCommandBlocking } from '#tests/harness/command.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import type { PreparedVulture } from '#tests/types/tools/execution.ts';
import { buildToolsPath, installPrivateTools } from '#tests/harness/install.ts';
import { PYTHON_ENVIRONMENT_DIRECTORY } from '#cli/config/platform/locations.ts';

test('ShellCheck rejects partial findings when another selected file cannot be read', async () => {
    await using sandbox = await testdir();
    const source = '#!/usr/bin/env bash\necho $unquoted\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['bash']),
        'sample.sh': source,
    });
    const session = await openSession(sandbox.path);
    const plans = planRun(session, { stage: 'commit', skips: [], only: ['bash/shellcheck'] });
    const planned = plans[0]!;
    const command = ['shellcheck', '--norc', '--format=gcc', 'sample.sh'];
    const paths = { cwd: sandbox.path, root: sandbox.path };
    const broken = runTestCommandBlocking([...command, 'missing.sh'], { cwd: sandbox.path });
    expect(broken.code, broken.stderr).toBe(2);
    expect(broken.stdout).toContain('SC2086');
    const result = {
        code: broken.code,
        stdout: broken.stdout,
        stderr: broken.stderr,
        missing: false,
        duration: 1,
    };
    expect(() => checkedFindings(planned, result, paths)).toThrow('missing.sh');
    const defect = runTestCommandBlocking(command, { cwd: sandbox.path });
    expect(defect.code).toBe(1);
    expect(
        checkedFindings(planned, { ...result, code: defect.code, stdout: defect.stdout, stderr: defect.stderr }, paths),
    ).toContainEqual(containing({ file: 'sample.sh', line: 2, rule: 'SC2086' }));
    expect(await Bun.file(join(sandbox.path, 'sample.sh')).text()).toBe(source);
    await Bun.write(join(sandbox.path, 'sample.sh'), '#!/usr/bin/env bash\nprintf "%s\\n" "${1:-}"\n');
    const corrected = runTestCommandBlocking(command, { cwd: sandbox.path });
    expect(corrected.code).toBe(0);
    expect(
        checkedFindings(
            planned,
            {
                ...result,
                code: corrected.code,
                stdout: corrected.stdout,
                stderr: corrected.stderr,
            },
            paths,
        ),
    ).toStrictEqual([]);
});

// The plan for the vulture check of a sandbox, and the environment that reaches the vulture gspot installed for it.
async function preparedVulture(root: string): Promise<PreparedVulture> {
    // The tool comes from the installation gspot makes for the sandbox, which no runner puts on PATH.
    const applied = await spawnGspot(root, ['apply']);
    if (applied.code !== 0) throw new Error(`The sandbox apply failed: ${applied.stdout}${applied.stderr}`);
    await installPrivateTools(root);
    const session = await openSession(root);
    const plans = planRun(session, { stage: 'push', skips: [], only: ['python/vulture'] });
    const bin = environmentBin(join(root, PYTHON_ENVIRONMENT_DIRECTORY));
    return { planned: plans[0]!, env: { ...environmentVariables(), PATH: [bin, buildToolsPath([])].join(delimiter) } };
}

test(
    'Vulture rejects incomplete analysis even when dead-code findings set exit 3',
    async () => {
        await using sandbox = await testdir();
        const source = 'import os\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['python'], { level: 'all' }),
            'sample.py': source,
            'broken.py': 'print("Ready")\n',
        });
        const { planned, env } = await preparedVulture(sandbox.path);
        const command = ['vulture', '--min-confidence', '80', 'sample.py', 'broken.py'];
        const paths = { cwd: sandbox.path, root: sandbox.path };
        const exit = { missing: false, duration: 1 };
        for (const brokenSource of ['def broken(:\n', 'value = "\u0000"\n']) {
            await Bun.write(join(sandbox.path, 'broken.py'), brokenSource);
            const broken = runTestCommandBlocking(command, { cwd: sandbox.path, env });
            expect(broken.code, broken.stderr).toBe(3);
            expect(broken.stdout).toContain("unused import 'os'");
            const result = {
                ...exit,
                code: broken.code,
                stdout: broken.stdout,
                stderr: broken.stderr,
            };
            expect(() => checkedFindings(planned, result, paths)).toThrow(GspotError);
            expect(await Bun.file(join(sandbox.path, 'broken.py')).text()).toBe(brokenSource);
        }
        await Bun.write(join(sandbox.path, 'broken.py'), 'print("Ready")\n');
        const defect = runTestCommandBlocking(command, { cwd: sandbox.path, env });
        expect(defect.code).toBe(3);
        const found = {
            ...exit,
            code: defect.code,
            stdout: defect.stdout,
            stderr: defect.stderr,
        };
        expect(checkedFindings(planned, found, paths)).toContainEqual(
            containing({ file: 'sample.py', line: 1, message: "unused import 'os' (90% confidence)" }),
        );
        expect(await Bun.file(join(sandbox.path, 'sample.py')).text()).toBe(source);
        await Bun.write(join(sandbox.path, 'sample.py'), 'print("Ready")\n');
        const corrected = runTestCommandBlocking(command, { cwd: sandbox.path, env });
        expect(corrected.code).toBe(0);
        const clean = {
            ...exit,
            code: corrected.code,
            stdout: corrected.stdout,
            stderr: corrected.stderr,
        };
        expect(checkedFindings(planned, clean, paths)).toStrictEqual([]);
    },
    NATIVE_TEST_TIMEOUT_MS,
);
