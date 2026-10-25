export const ANSIBLE_CONFIG = '[defaults]\ninventory = inventory\n';

export const ANSIBLE_PLAYBOOK = `---
- name: Deploy the service
  hosts: all
  tasks:
    - name: Restart the service
      ansible.builtin.systemd:
        name: test
        state: restarted
`;

export const ANSIBLE_SANDBOX = {
    configurations: ['ansible'],
    files: { 'deploy/ansible.cfg': ANSIBLE_CONFIG, 'deploy/site.yml': ANSIBLE_PLAYBOOK },
} as const;
