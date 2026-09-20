// Planted repository for the ansible preset: a task that shells out to systemctl.
import { createSandbox } from '@gspot/testing';
import type { PlantedCase } from '#types/run.ts';
import { describe, expect, test } from 'bun:test';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, runPlanted, toolsPath } from '#tests/harness/planted.ts';

const INIT = [
    'init',
    '--yes',
    '--presets',
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
    '    - name: Restart the service\n      ansible.builtin.systemd:\n          name: planted\n          state: restarted\n',
);
const SHELLED = play(
    '    - name: Restart the service\n      ansible.builtin.command: systemctl restart planted\n      changed_when: true\n',
);

const CASES: PlantedCase[] = [
    { check: 'ansible/lint', files: { 'deploy/site.yml': SHELLED }, expected: 'command-instead-of-module' },
];

describe('the ansible preset', () => {
    test(
        'ansible-lint runs where the ansible.cfg is, and its findings carry the folder',
        async () => {
            await using sandbox = await createSandbox({
                'deploy/ansible.cfg': '[defaults]\ninventory = inventory\n',
                'deploy/site.yml': CLEAN,
            });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['ansible-lint', 'typos', 'ec', 'taplo', 'yamllint']) };
            await install(sandbox.path, INIT, environment);
            const clean = await run(sandbox.path, ['check', '--only', 'ansible/lint', '--no-cache'], environment);
            expect(clean.code, clean.stdout + clean.stderr).toBe(0);
            for (const planted of CASES) {
                const outcome = await runPlanted(sandbox.path, planted, environment);
                if (process.platform === 'win32') {
                    expect(outcome.code, outcome.stdout + outcome.stderr).toBe(0);
                    expect(outcome.stdout).toMatch(/skipped\s+ansible\/lint\s+\(platform\)/u);
                    continue;
                }
                expect(outcome.code, `${planted.check}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
                expect(outcome.stdout).toContain(planted.expected);
                expect(outcome.stdout).toContain('deploy/site.yml:');
            }
        },
        PLANTED_TIMEOUT_MS * 4,
    );
});
