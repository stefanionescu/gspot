export const COMMAND_PLAYBOOK = `---
- name: Deploy the service
  hosts: all
  tasks:
    - name: Restart the service
      ansible.builtin.command: systemctl restart test
      changed_when: true
`;
