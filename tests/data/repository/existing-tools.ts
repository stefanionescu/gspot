export const LINKED_HOOK_FOLDERS = [
    { path: '.husky', kind: 'husky' },
    { path: '.githooks', kind: 'githooks' },
] as const;

export const LINKED_RULE_FOLDERS = ['.cursor/rules', '.claude/rules'] as const;

export const LINKED_HOOK_FILES = [
    { path: '.lefthook.yml', kind: 'lefthook' },
    { path: '.pre-commit-config.yaml', kind: 'pre-commit' },
] as const;

export const LEFTHOOK_FILES = ['lefthook.yml', '.config/lefthook.yml', 'lefthook-local.yml'] as const;
