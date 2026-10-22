export const ANSIBLE_CONFIG = '[defaults]\ninventory = inventory\n';

export const ANSIBLE_PLAYBOOK = `---\n- name: Deploy the service\n  hosts: all\n  tasks:\n    - name: Restart the service\n      ansible.builtin.systemd:\n        name: test\n        state: restarted\n`;

export const ANSIBLE_SANDBOX = {
    configurations: ['ansible'],
    files: { 'deploy/ansible.cfg': ANSIBLE_CONFIG, 'deploy/site.yml': ANSIBLE_PLAYBOOK },
} as const;
