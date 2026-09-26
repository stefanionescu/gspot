import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';
import { chmodSync, existsSync, writeFileSync } from 'node:fs';

const versionScript = (version: string, slow: boolean): string => `#!${process.execPath}
if (process.argv.includes('--version')) { console.log(${JSON.stringify(version)}); }
else { await Bun.write('started.txt', 'started'); ${slow ? 'await Bun.sleep(10_000);' : ''} }
`;

test.each(['outdated', 'timeout', 'canceled'] as const)(
    'Ansible adapter reports %s through the shared runner and accepts corrected execution',
    async (failure) => {
        await using sandbox = await testdir();
        const executable = join(sandbox.path, '.gspot/.venv/bin/ansible-lint');
        const version = failure === 'outdated' ? '23.0.0' : '26.8.0';
        await createFileTree(sandbox.path, {
            'gspot.toml':
                'version = 1\nlevel = "all"\nconfigurations = ["ansible", "structure"]\n[limits]\ntool_seconds = 1\n',
            'deploy/ansible.cfg': '[defaults]\n',
            'deploy/site.yml': '---\n- hosts: all\n  tasks: []\n',
            '.gspot/.venv/bin/ansible-lint': versionScript(version, failure !== 'outdated'),
        });
        chmodSync(executable, 0o755);
        const controller = new AbortController();
        const session = await openSession(sandbox.path);
        const options = {
            stage: 'all' as const,
            skips: [],
            only: ['ansible/lint'],
            fix: false,
            isDryRun: false,
            noCache: true,
        };
        const running = executeRun(session, { ...options, cancelSignal: controller.signal });
        try {
            const started = join(sandbox.path, 'deploy/started.txt');
            if (failure === 'canceled') {
                const deadline = performance.now() + 5000;
                while (!existsSync(started) && performance.now() < deadline) await Bun.sleep(20);
            }
            // The cancellation reaches a tool that has started running.
            expect(failure !== 'canceled' || existsSync(started)).toBe(true);
            if (failure === 'canceled') controller.abort();
            const outcome = await running;
            expect(outcome.report.exitCode).toBe(2);
            expect(outcome.report.checks).toHaveLength(1);
            expect(outcome.report.checks[0]!.status).toBe(failure === 'outdated' ? 'missing' : 'error');
            expect(outcome.report.checks[0]!.note).toContain(
                failure === 'outdated' ? 'is below 24.0.0' : failure === 'timeout' ? 'ran past 1 seconds' : 'canceled',
            );
            expect(outcome.report.checks[0]!.findings).toStrictEqual([]);
            expect(existsSync(join(sandbox.path, 'deploy/started.txt'))).toBe(failure !== 'outdated');
            writeFileSync(executable, versionScript('26.8.0', false));
            const corrected = await executeRun(await openSession(sandbox.path), options);
            expect(corrected.report.exitCode).toBe(0);
            expect(corrected.report.checks[0]!.status).toBe('ok');
        } finally {
            controller.abort();
            await running;
        }
    },
);

const versionCommand = (version: string): string =>
    `#!${process.execPath}\nif (process.argv.includes('--version')) console.log(${JSON.stringify(version)});\n`;

test('an adapter observes a changed executable version on the next command instead of reusing its old success', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nlevel = "all"\nconfigurations = ["ansible"]\n',
        '.gitignore': '.gspot/\n.venv/\n',
        'ansible.cfg': '[defaults]\n',
        'site.yml': '---\n- hosts: all\n  tasks: []\n',
        '.gspot/.venv/bin/ansible-lint': versionCommand('26.8.0'),
    });
    const executable = join(sandbox.path, '.gspot/.venv/bin/ansible-lint');
    chmodSync(executable, 0o755);
    const options = { stage: 'commit' as const, skips: [], only: ['ansible/lint'], fix: false, isDryRun: false };
    const initial = await executeRun(await openSession(sandbox.path), options);
    expect(initial.report.checks[0]!.status).toBe('ok');
    writeFileSync(executable, versionCommand('23.0.0'));
    const changed = await executeRun(await openSession(sandbox.path), options);
    expect(changed.report.exitCode).toBe(2);
    expect(changed.report.checks[0]!.status).toBe('missing');
    expect(changed.report.checks[0]!.note).toContain('23.0.0 is below 24.0.0');
    writeFileSync(executable, versionCommand('26.8.0'));
    expect((await executeRun(await openSession(sandbox.path), options)).report.exitCode).toBe(0);
});

const exitScript = (failed: boolean): string => `#!${process.execPath}\nprocess.exitCode = ${failed ? '1' : '0'};\n`;

test('cached results observe executable replacement and permissions in a reused session', async () => {
    await using sandbox = await testdir();
    const executable = join(sandbox.path, 'checker');
    await createFileTree(sandbox.path, {
        'gspot.toml': `version = 1\nconfigurations = []\n[[check]]\nname = "project/cache"\nstage = "commit"\npaths = ["source.txt"]\ninputs = ["source.txt"]\ncommand = ${JSON.stringify([executable])}\n`,
        'source.txt': 'input\n',
        checker: exitScript(false),
    });
    chmodSync(executable, 0o755);
    const session = await openSession(sandbox.path);
    const options = { stage: 'commit' as const, skips: [], fix: false, isDryRun: false };
    expect((await executeRun(session, options)).report.exitCode).toBe(0);
    expect((await executeRun(session, options)).report.checks[0]!.status).toBe('cache');
    writeFileSync(executable, exitScript(true));
    const changed = await executeRun(session, options);
    expect(changed.report.exitCode).toBe(1);
    expect(changed.report.checks[0]!.status).toBe('fail');
    chmodSync(executable, 0o644);
    expect((await executeRun(session, options)).report.exitCode).toBe(2);
    chmodSync(executable, 0o755);
    writeFileSync(executable, exitScript(false));
    expect((await executeRun(session, options)).report.exitCode).toBe(0);
});
