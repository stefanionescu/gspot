import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { planRun } from '#cli/execution/planning/plan.ts';
import { createFileTree, testdir } from 'testdirs';
import { openSession } from '#cli/execution/session.ts';
import { containing } from '#tests/support/expectations.ts';
import { checkedFindings } from '#cli/execution/broken-tool.ts';
import { ToolOutputError } from '#cli/execution/output/tool-formats.ts';

test('ShellCheck rejects partial findings when another selected file cannot be read', async () => {
    await using sandbox = await testdir();
    const source = '#!/usr/bin/env bash\necho $unquoted\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["bash"]\n',
        'sample.sh': source,
    });
    const session = await openSession(sandbox.path);
    const plans = await planRun(session, { stage: 'commit', skips: [], only: ['bash/shellcheck'] });
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

test.each(['def broken(:\n', 'value = "\u0000"\n'])(
    'Vulture rejects incomplete analysis of %j even when dead-code findings set exit 3',
    async (brokenSource) => {
        await using sandbox = await testdir();
        const source = 'import os\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nlevel = "all"\nconfigurations = ["python"]\n',
            'sample.py': source,
            'broken.py': brokenSource,
        });
        const session = await openSession(sandbox.path);
        const plans = await planRun(session, { stage: 'push', skips: [], only: ['python/vulture'] });
        const planned = plans[0]!;
        const command = ['vulture', '--min-confidence', '80', 'sample.py', 'broken.py'];
        const roots: [string, string] = [sandbox.path, sandbox.path];
        const broken = Bun.spawnSync(command, { cwd: sandbox.path });
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
        const defect = Bun.spawnSync(command, { cwd: sandbox.path });
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
    },
);
