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

export const LEFTHOOK_FILES = ['lefthook.yml', '.config/lefthook.yml', 'lefthook-local.yml'];

/** Native read errors remain actionable failures after containment is checked. */
export const SURVEY_READ_ERRORS = ['EIO', 'EACCES'];
