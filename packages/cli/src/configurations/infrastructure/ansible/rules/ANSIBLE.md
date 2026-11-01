# Ansible

Read this rule when you change an Ansible playbook, role, or collection.

- Use the fully qualified name of each module, such as `ansible.builtin.copy`.
- Give every task a name.
- Set `changed_when` on each command task, so that a run reports only real changes.
- Set an explicit `mode` on each file that a task writes.
