import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { InstalledScenario } from '#tests/types/harness/repository.ts';

export const CLEAN = `---\n- name: Deploy the service\n  hosts: all\n  tasks:\n    - name: Restart the service\n      ansible.builtin.systemd:\n        name: test\n        state: restarted\n`;

export const SHELLED = `---\n- name: Deploy the service\n  hosts: all\n  tasks:\n    - name: Restart the service\n      ansible.builtin.command: systemctl restart test\n      changed_when: true\n`;

export const REPOSITORY: InstalledScenario = {
    configurations: ['ansible'],
    tools: ['ansible-lint', 'taplo', 'yamllint'],
    files: { 'deploy/ansible.cfg': '[defaults]\ninventory = inventory\n', 'deploy/site.yml': CLEAN },
};

export const CASES: FindingCase[] = [
    {
        check: 'ansible/lint',
        files: { 'deploy/site.yml': SHELLED },
        expected: { file: 'deploy/site.yml', rule: 'command-instead-of-module', line: 5 },
        corrected: { files: { 'deploy/site.yml': CLEAN } },
    },
];
