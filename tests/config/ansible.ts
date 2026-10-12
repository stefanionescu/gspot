export const ANSIBLE_PLAYBOOK = `---\n- name: Deploy the service\n  hosts: all\n  tasks:\n    - name: Restart the service\n      ansible.builtin.systemd:\n        name: test\n        state: restarted\n`;

export const SHELLED_PLAYBOOK = `---\n- name: Deploy the service\n  hosts: all\n  tasks:\n    - name: Restart the service\n      ansible.builtin.command: systemctl restart test\n      changed_when: true\n`;

export const ANSIBLE_SANDBOX = {
    configurations: ['ansible'],
    tools: ['ansible-lint', 'taplo', 'yamllint'],
    files: { 'deploy/ansible.cfg': '[defaults]\ninventory = inventory\n', 'deploy/site.yml': ANSIBLE_PLAYBOOK },
} as const;

export const ANSIBLE_CASES = [
    {
        check: 'ansible/ansible-lint',
        files: { 'deploy/site.yml': SHELLED_PLAYBOOK },
        expected: { file: 'deploy/site.yml', rule: 'command-instead-of-module', line: 5 },
        corrected: { files: { 'deploy/site.yml': ANSIBLE_PLAYBOOK } },
    },
] as const;
