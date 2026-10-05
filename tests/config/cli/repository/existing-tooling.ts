export const PACKAGE_HOOK_CONFIGURATIONS = ['null', '{}', '{"pre-commit":"echo authored"}'] as const;

export const LINKED_HOOK_FOLDERS = [
    { path: '.husky', kind: 'husky' } as const,
    { path: '.githooks', kind: 'githooks' } as const,
];

export const LINKED_RULE_FOLDERS = ['.cursor/rules', '.claude/rules'];

export const LINKED_HOOK_FILES = [
    { path: '.lefthook.yml', kind: 'lefthook' } as const,
    { path: '.pre-commit-config.yaml', kind: 'pre-commit' } as const,
];
