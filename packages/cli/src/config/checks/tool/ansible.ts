// The literal values checks/tool/ansible reads: names, patterns, limits, and tables.

export const ANSIBLE_PROJECT_FILE = 'ansible.cfg';
export const LINT_LINE = /^(?<file>[^:]+):(?<line>\d+):[\d:]* (?<rule>[^:]+): (?<text>.*)$/u;
