import { QUIET_INIT } from '#tests/config/harness/init.ts';

export const CLEAN = `---\n- name: Deploy the service\n  hosts: all\n  tasks:\n    - name: Restart the service\n      ansible.builtin.systemd:\n        name: test\n        state: restarted\n`;

export const ANSIBLE_INIT = ['init', '--yes', '--configurations', 'ansible', ...QUIET_INIT];

/** The configurations the ansible sandbox leaves out after init. */
export const ANSIBLE_LEFT_OUT = ['spelling'];

export const SHELLED = `---\n- name: Deploy the service\n  hosts: all\n  tasks:\n    - name: Restart the service\n      ansible.builtin.command: systemctl restart test\n      changed_when: true\n`;
