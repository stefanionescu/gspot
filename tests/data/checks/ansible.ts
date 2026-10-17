export const ANSIBLE_PLAYBOOK = `---\n- name: Deploy the service\n  hosts: all\n  tasks:\n    - name: Restart the service\n      ansible.builtin.systemd:\n        name: test\n        state: restarted\n`;

export const COMMAND_PLAYBOOK = `---\n- name: Deploy the service\n  hosts: all\n  tasks:\n    - name: Restart the service\n      ansible.builtin.command: systemctl restart test\n      changed_when: true\n`;

export const ANSIBLE_SANDBOX = {
    configurations: ['ansible'],
    files: { 'deploy/ansible.cfg': '[defaults]\ninventory = inventory\n', 'deploy/site.yml': ANSIBLE_PLAYBOOK },
} as const;
