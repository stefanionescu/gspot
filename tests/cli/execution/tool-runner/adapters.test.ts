import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { chmod, writeFile } from 'node:fs/promises';
import * as processes from '#cli/platform/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { executeRun } from '#cli/execution/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { waitForFile } from '#tests/harness/process.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { hasToolBuild } from '#tests/harness/platforms.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { FAILING_SCRIPT, PASSING_SCRIPT } from '#tests/config/cli/execution/tool-runner/adapters.ts';

const versionScript = (version: string, slow = false): string => `#!${process.execPath}
if (process.argv.includes('--version')) { console.log(${JSON.stringify(version)}); }
else { await Bun.write('started.txt', 'started'); ${slow ? 'await Bun.sleep(10_000);' : ''} }
`;

test.skipIf(!hasToolBuild('ansible-lint')).each(['timeout', 'canceled'] as const)(
    'Ansible adapter reports a %s run through the shared runner and accepts corrected execution',
    async (failure) => {
        await using sandbox = await testdir();
        const executable = join(sandbox.path, '.gspot/.venv/bin/ansible-lint');
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['ansible', 'structure'], {
                tables: failure === 'timeout' ? 'tool_timeout_seconds = 1\n' : '',
                level: 'all',
            }),
            'deploy/ansible.cfg': '[defaults]\n',
            'deploy/site.yml': '---\n- hosts: all\n  tasks: []\n',
            '.gspot/.venv/bin/ansible-lint': versionScript('26.8.0', true),
        });
        await chmod(executable, 0o755);
        using timeout =
            failure === 'timeout'
                ? spyOn(processes, 'run').mockResolvedValue({
                      code: 1,
                      stdout: '',
                      stderr: '',
                      missing: false,
                      duration: 1,
                      isTimedOut: true,
                  })
                : undefined;
        const controller = new AbortController();
        const session = await openSession(sandbox.path);
        const options = buildRunOptions({ only: ['ansible/lint'] });
        const running = executeRun(session, { ...options, cancelSignal: controller.signal });
        try {
            const started = join(sandbox.path, 'deploy/started.txt');
            if (failure === 'canceled') {
                expect(await waitForFile(started)).toBe(true);
            }
            // The cancellation reaches a tool that has started running.
            if (failure === 'canceled') controller.abort();
            const outcome = await running;
            expect(outcome.report.exitCode).toBe(2);
            expect(outcome.report.checks).toHaveLength(1);
            expect(outcome.report.checks[0]!.status).toBe('error');
            expect(outcome.report.checks[0]!.note).toContain(
                { timeout: 'ran past 1 seconds', canceled: 'canceled' }[failure],
            );
            expect(outcome.report.checks[0]!.findings).toStrictEqual([]);
            if (failure === 'canceled') expect(await pathExists(started)).toBe(true);
            if (timeout !== undefined)
                timeout.mockResolvedValue({ code: 0, stdout: '', stderr: '', missing: false, duration: 1 });
            await writeFile(executable, versionScript('26.8.0'));
            const corrected = await executeRun(await openSession(sandbox.path), options);
            expect(corrected.report.exitCode).toBe(0);
            expect(corrected.report.checks[0]!.status).toBe('passed');
        } finally {
            controller.abort();
            await running;
        }
    },
);

test.skipIf(!hasToolBuild('ansible-lint'))('an adapter reports a version below the floor as missing', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['ansible'], { level: 'all' }),
        '.gitignore': '.gspot/\n.venv/\n',
        'ansible.cfg': '[defaults]\n',
        'site.yml': '---\n- hosts: all\n  tasks: []\n',
        '.gspot/.venv/bin/ansible-lint': versionScript('26.8.0'),
    });
    const executable = join(sandbox.path, '.gspot/.venv/bin/ansible-lint');
    await chmod(executable, 0o755);
    const options = buildRunOptions({ stage: 'commit', only: ['ansible/lint'] });
    const initial = await executeRun(await openSession(sandbox.path), options);
    expect(initial.report.checks[0]!.status).toBe('passed');
    await writeFile(executable, versionScript('23.0.0'));
    const changed = await executeRun(await openSession(sandbox.path), options);
    expect(changed.report.exitCode).toBe(2);
    expect(changed.report.checks[0]!.status).toBe('missing');
    expect(changed.report.checks[0]!.note).toContain('23.0.0 is below 24.0.0');
    await writeFile(executable, versionScript('26.8.0'));
    const executed = await executeRun(await openSession(sandbox.path), options);
    expect(executed.report.exitCode).toBe(0);
});

// Windows keeps no permission bits to read back.
test.skipIf(!isPosix)('a reused session runs a replaced executable and reads its permissions', async () => {
    await using sandbox = await testdir();
    const executable = join(sandbox.path, 'checker');
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([], {
            tables: `[check."project/checker"]\nstage = "commit"\npaths = ["source.txt"]\ncommand = ${JSON.stringify([executable])}\n`,
        }),
        'source.txt': 'input\n',
        checker: PASSING_SCRIPT,
    });
    await chmod(executable, 0o755);
    const session = await openSession(sandbox.path);
    const options = buildRunOptions({ stage: 'commit', only: ['project/checker'] });
    const executed = await executeRun(session, options);
    expect(executed.report.exitCode).toBe(0);
    const repeated = await executeRun(session, options);
    expect(repeated.report.checks[0]!.status).toBe('passed');
    await writeFile(executable, FAILING_SCRIPT);
    const changed = await executeRun(session, options);
    expect(changed.report.exitCode).toBe(1);
    expect(changed.report.checks[0]!.status).toBe('failed');
    await chmod(executable, 0o644);
    const unexecutable = await executeRun(session, options);
    expect(unexecutable.report.exitCode).toBe(2);
    await chmod(executable, 0o755);
    await writeFile(executable, PASSING_SCRIPT);
    const restored = await executeRun(session, options);
    expect(restored.report.exitCode).toBe(0);
});
