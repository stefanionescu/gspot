// Sandbox for the ansible configuration: a task that shells out to systemctl.
import { join } from 'node:path';
import { commitAll } from '#tests/harness/git.ts';
import { test, expect, describe } from 'bun:test';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { runCheckCase } from '#tests/harness/check-case.ts';
import { levelSchema } from '#cli/parsers/schema/settings.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { detectConfigurations } from '#cli/configurations/detect.ts';
import { spawnGspot, buildRunOptions } from '#tests/harness/gspot.ts';
import { sharePythonTools } from '#tests/harness/python-installation.ts';
import { buildToolsPath, initRepository } from '#tests/harness/install.ts';
import { containing, containingAll } from '#tests/harness/expectations.ts';
import { CLEAN, SHELLED, ANSIBLE_INIT } from '#tests/config/tools/configurations/tool/ansible.ts';

describe('the ansible configuration', () => {
    test('ansible-lint runs where the ansible.cfg is, and its findings keep the folder', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'deploy/ansible.cfg': '[defaults]\ninventory = inventory\n',
            'deploy/site.yml': CLEAN,
        });
        commitAll(sandbox.path);
        const environment = { PATH: buildToolsPath(['ansible-lint', 'typos', 'ec', 'taplo', 'yamllint']) };
        await initRepository(sandbox.path, ANSIBLE_INIT, environment, { level: 'all' });
        const outcome = await runCheckCase(
            sandbox.path,
            {
                check: 'ansible/lint',
                files: { 'deploy/site.yml': SHELLED },
            },
            environment,
        );
        const report = JSON.parse(outcome.stdout) as RunReport;
        // ansible-lint has no Windows build, so the check is skipped there for the platform and the run passes.
        const isWindows = process.platform === 'win32';
        const commandInsteadOfModule: Finding = containing({
            check: 'ansible/lint',
            file: 'deploy/site.yml',
            rule: 'command-instead-of-module',
            line: 5,
        });
        const expectedFindings: Finding[] = containingAll([commandInsteadOfModule]);
        expect(outcome.code, outcome.stdout + outcome.stderr).toBe(isWindows ? 0 : 1);
        expect(report.checks).toMatchObject([{ check: 'ansible/lint', status: isWindows ? 'skipped' : 'failed' }]);
        expect(report.skips.some((skip) => skip.check === 'ansible/lint' && skip.cause === 'platform')).toBe(isWindows);
        expect(report.checks[0]?.findings).toStrictEqual(isWindows ? [] : expectedFindings);
        const corrected = await spawnGspot(sandbox.path, ['check', '--only', 'ansible/lint', '--json'], environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
            { check: 'ansible/lint', status: isWindows ? 'skipped' : 'passed', findings: [] },
        ]);
    });
});

test.each(levelSchema.options)(
    'Ansible detects configless projects and lints each selected scope at level %s',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['ansible'], { level, tables: '[scope.app]\nconfigurations = ["ansible"]\n' }),
            'requirements.yml': 'collections: []\n',
            'site.yml': SHELLED,
            'app/requirements.yml': 'collections: []\n',
            'app/site.yml': SHELLED,
        });
        await sharePythonTools(sandbox.path);
        const session = await openSession(sandbox.path);
        for (const scope of ['', 'app']) {
            expect(
                detectConfigurations(session.repository.files, session.manifests, [], scope).map(
                    ({ configuration }) => configuration,
                ),
            ).toContain('ansible');
        }
        const failed = await executeRun(session, buildRunOptions({ stage: 'commit', only: ['ansible/lint'] }));
        expect(failed.report.exitCode, JSON.stringify(failed.report)).toBe(1);
        expect(
            failed.report.checks.map(({ scope, status, findings }) => ({
                scope,
                status,
                findings: findings.map(({ file, rule }) => ({ file, rule })),
            })),
        ).toStrictEqual([
            { scope: '', status: 'failed', findings: [{ file: 'site.yml', rule: 'command-instead-of-module' }] },
            { scope: 'app', status: 'failed', findings: [{ file: 'app/site.yml', rule: 'command-instead-of-module' }] },
        ]);
        await Bun.write(join(sandbox.path, 'site.yml'), CLEAN);
        await Bun.write(join(sandbox.path, 'app/site.yml'), CLEAN);
        const corrected = await executeRun(
            await openSession(sandbox.path),
            buildRunOptions({ stage: 'commit', only: ['ansible/lint'] }),
        );
        expect(corrected.report.exitCode, JSON.stringify(corrected.report)).toBe(0);
    },
);
