// Test repository for the ansible configuration: a task that shells out to systemctl.
import { commitAll } from '#tests/harness/git.ts';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { runCheckCase } from '#tests/harness/check-case.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { install, buildToolsPath } from '#tests/harness/install.ts';
import { containing, containingAll } from '#tests/harness/expectations.ts';
import { CLEAN, SHELLED, ANSIBLE_INIT } from '#tests/config/tools/configurations/tool/ansible.ts';

describe('the ansible configuration', () => {
    test(
        'ansible-lint runs where the ansible.cfg is, and its findings keep the folder',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'deploy/ansible.cfg': '[defaults]\ninventory = inventory\n',
                'deploy/site.yml': CLEAN,
            });
            commitAll(sandbox.path);
            const environment = { PATH: buildToolsPath(['ansible-lint', 'typos', 'ec', 'taplo', 'yamllint']) };
            await install(sandbox.path, ANSIBLE_INIT, environment, { level: 'all' });
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
            expect(report.skips.some((skip) => skip.check === 'ansible/lint' && skip.cause === 'platform')).toBe(
                isWindows,
            );
            expect(report.checks[0]?.findings).toStrictEqual(isWindows ? [] : expectedFindings);
            const corrected = await spawnGspot(
                sandbox.path,
                ['check', '--only', 'ansible/lint', '--json'],
                environment,
            );
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
                { check: 'ansible/lint', status: isWindows ? 'skipped' : 'passed', findings: [] },
            ]);
        },
        NATIVE_TEST_TIMEOUT_MS,
    );
});
