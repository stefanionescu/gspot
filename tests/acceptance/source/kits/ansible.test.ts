// Planted repository for the ansible configuration: a task that shells out to systemctl.
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import type { Finding } from '#cli/types/checks.ts';
import { run } from '#tests/support/cli/command.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/inputs/cli.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { toolsPath, installAtLevel } from '#tests/support/cli/tools.ts';
import { containing, containingAll } from '#tests/support/expectations.ts';
import { ANSIBLE_INIT } from '#tests/inputs/acceptance/source/kits/init-arguments.ts';

const CLEAN = `---\n- name: Deploy the service\n  hosts: all\n  tasks:\n    - name: Restart the service\n      ansible.builtin.systemd:\n        name: planted\n        state: restarted\n`;
const SHELLED = `---\n- name: Deploy the service\n  hosts: all\n  tasks:\n    - name: Restart the service\n      ansible.builtin.command: systemctl restart planted\n      changed_when: true\n`;

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
            const environment = { PATH: toolsPath(['ansible-lint', 'typos', 'ec', 'taplo', 'yamllint']) };
            await installAtLevel(sandbox.path, ANSIBLE_INIT, environment);
            const outcome = await runPlanted(
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
            expect(report.checks).toMatchObject([{ check: 'ansible/lint', status: isWindows ? 'skipped' : 'fail' }]);
            expect(report.skips.some((skip) => skip.check === 'ansible/lint' && skip.source === 'platform')).toBe(
                isWindows,
            );
            expect(report.checks[0]?.findings).toStrictEqual(isWindows ? [] : expectedFindings);
            const corrected = await run(
                sandbox.path,
                ['check', '--only', 'ansible/lint', '--no-cache', '--json'],
                environment,
            );
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
                { check: 'ansible/lint', status: isWindows ? 'skipped' : 'ok', findings: [] },
            ]);
        },
        PLANTED_TIMEOUT_MS * 4,
    );
});
