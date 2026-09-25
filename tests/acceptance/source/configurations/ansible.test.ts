import { join } from 'node:path';
import { reportSchema } from '#cli/execution/report.ts';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import { install, toolsPath } from '#tests/support/cli/tools.ts';
// Planted repository for the ansible configuration: a task that shells out to systemctl.
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';

const INIT = [
    'init',
    '--yes',
    '--configurations',
    'ansible',
    '--without',
    'spelling',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-rules',
    '--no-install',
];
const play = (task: string): string => `---\n- name: Deploy the service\n  hosts: all\n  tasks:\n${task}`;
const CLEAN = play(
    '    - name: Restart the service\n      ansible.builtin.systemd:\n        name: planted\n        state: restarted\n',
);
const SHELLED = play(
    '    - name: Restart the service\n      ansible.builtin.command: systemctl restart planted\n      changed_when: true\n',
);

describe('the ansible configuration', () => {
    test(
        'ansible-lint runs where the ansible.cfg is, and its findings carry the folder',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'deploy/ansible.cfg': '[defaults]\ninventory = inventory\n',
                'deploy/site.yml': CLEAN,
            });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['ansible-lint', 'typos', 'ec', 'taplo', 'yamllint']) };
            await install(sandbox.path, INIT, environment);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            const outcome = await runPlanted(
                sandbox.path,
                {
                    check: 'ansible/lint',
                    files: { 'deploy/site.yml': SHELLED },
                },
                environment,
            );
            const report = reportSchema.parse(await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json());
            if (process.platform === 'win32') {
                expect(outcome.code, outcome.stdout + outcome.stderr).toBe(0);
                expect(report.checks).toMatchObject([{ check: 'ansible/lint', status: 'skipped' }]);
                expect(report.skips).toContainEqual({ check: 'ansible/lint', source: 'platform' });
                return;
            }
            expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
            expect(report.checks).toMatchObject([{ check: 'ansible/lint', status: 'fail' }]);
            expect(report.checks[0]?.findings).toContainEqual(
                expect.objectContaining({
                    check: 'ansible/lint',
                    file: 'deploy/site.yml',
                    rule: 'command-instead-of-module',
                    line: 5,
                }),
            );
            const corrected = await run(
                sandbox.path,
                ['check', '--only', 'ansible/lint', '--no-cache', '--json'],
                environment,
            );
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks).toMatchObject([
                { check: 'ansible/lint', status: 'ok', findings: [] },
            ]);
        },
        PLANTED_TIMEOUT_MS * 4,
    );
});
