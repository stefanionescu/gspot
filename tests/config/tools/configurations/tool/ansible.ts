import { QUIET_INIT } from '#tests/config/harness/init.ts';

export const CLEAN = `---\n- name: Deploy the service\n  hosts: all\n  tasks:\n    - name: Restart the service\n      ansible.builtin.systemd:\n        name: test\n        state: restarted\n`;

export const ANSIBLE_INIT = ['init', '--yes', '--configurations', 'ansible', ...QUIET_INIT];

export const SHELLED = `---\n- name: Deploy the service\n  hosts: all\n  tasks:\n    - name: Restart the service\n      ansible.builtin.command: systemctl restart test\n      changed_when: true\n`;
