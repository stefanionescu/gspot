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

export const LEFTHOOK_FILES = [
    'lefthook.yml',
    '.lefthook.yml',
    'lefthook.yaml',
    '.lefthook.yaml',
    '.config/lefthook.yml',
    '.config/lefthook.yaml',
    'lefthook.toml',
    '.lefthook.toml',
    '.config/lefthook.toml',
    'lefthook.json',
    '.lefthook.json',
    '.config/lefthook.json',
    'lefthook.jsonc',
    '.lefthook.jsonc',
    '.config/lefthook.jsonc',
    'lefthook-local.yml',
    '.lefthook-local.yml',
    'lefthook-local.yaml',
    '.lefthook-local.yaml',
    '.config/lefthook-local.yml',
    '.config/lefthook-local.yaml',
    'lefthook-local.toml',
    '.lefthook-local.toml',
    '.config/lefthook-local.toml',
    'lefthook-local.json',
    '.lefthook-local.json',
    '.config/lefthook-local.json',
    'lefthook-local.jsonc',
    '.lefthook-local.jsonc',
    '.config/lefthook-local.jsonc',
];

/** Native read errors remain actionable failures after containment is checked. */
export const SURVEY_READ_ERRORS = ['EIO', 'EACCES'];
