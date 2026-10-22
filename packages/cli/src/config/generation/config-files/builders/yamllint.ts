export const YAMLLINT_RULE_OPTIONS = {
    comments: { 'min-spaces-from-content': 1 },
    truthy: { 'check-keys': false },
    braces: { 'max-spaces-inside': 1 },
    brackets: { 'max-spaces-inside': 1 },
    indentation: { spaces: 'consistent', 'indent-sequences': 'consistent' },
} as const;

export const YAMLLINT_YAML_OPTIONS = { version: '1.1' } as const;

export const YAMLLINT_RULES = [
    'anchors',
    'braces',
    'brackets',
    'colons',
    'commas',
    'comments',
    'comments-indentation',
    'empty-lines',
    'hyphens',
    'indentation',
    'key-duplicates',
    'new-line-at-end-of-file',
    'new-lines',
    'trailing-spaces',
    'truthy',
] as const;
