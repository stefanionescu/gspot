import type { LintRuleDocs } from '#cli/types/tools/tools.ts';

export const YAML_REQUIRED_NAMES = new Set([
    'action.yaml',
    'analysis_options.yaml',
    'Chart.yaml',
    'compose.yaml',
    'compose.override.yaml',
    'docker-compose.yaml',
    'docker-compose.override.yaml',
    'kustomization.yaml',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    '.pre-commit-config.yaml',
    '.pre-commit-hooks.yaml',
    'pubspec.yaml',
    'values.yaml',
]);

export const YAML_TRUTHY = /^(?:[Yy][Ee][Ss]|[Nn][Oo]|[Oo][Nn]|[Oo][Ff][Ff]|True|TRUE|False|FALSE)$/u;

export const YAML_LEADING_ZERO = /^[+-]?(?:0\d+|0o[0-7]+)$/u;

export const YAML_TRAILING_ZERO = /^[+-]?\d+\.\d*0$/u;

export const YAML_GENERATED_ANCHOR = /^[a-z]?\d+$/iu;

export const YAML_COMMIT_USE = /^\s*(?:-\s+)?uses:\s*['"]?[^'"#\s]+@[\da-f]{40}['"]?\s*$/iu;

export const YAML_VERSION_COMMENT = /^#\s*v?\d+(?:\.\d+)*(?:[-+][\w.-]+)?\s*$/u;

export const YAML_RULES = {
    syntax: 'syntax',
    duplicate: 'key-duplicates',
    anchors: 'anchors',
    truthy: 'truthy',
    octal: 'octal-values',
    documents: 'documents',
    merge: 'merge-keys',
    anchorNames: 'anchor-names',
    version: 'version-numbers',
    comments: 'comments',
    extension: 'file-extension',
} as const;

export const YAML_MESSAGES = {
    extension: 'Use the .yml extension unless the consumer requires this .yaml file name.',
    documents:
        'Keep one YAML document per file. Accept this rule with a reason only when the consumer requires a stream.',
    merge: 'Do not use the << merge key. Write the mapping keys explicitly.',
    truthy: 'Quote this string, or write a boolean as true or false.',
    octal: 'Quote a value with a leading zero, or write the number in decimal without leading zeros.',
    version: 'Quote this value to preserve its trailing zero.',
    comments:
        'Move this comment above the key. Only a version comment after a uses value pinned to a full commit is allowed.',
};

export const YAML_RULE_DOCS = {
    [YAML_RULES.syntax]: {
        description: 'YAML must parse without syntax errors.',
        why: 'A consumer cannot read malformed YAML.',
        fix: 'Fix the syntax at the reported line, then check the file again.',
        example: '`items: [` needs a closing bracket, such as `items: []`.',
    },
    [YAML_RULES.duplicate]: {
        description: 'Each mapping key appears once.',
        why: 'Consumers can reject duplicate keys or silently discard one value.',
        fix: 'Keep one definition of the key and remove the other.',
        example: 'Replace two `enabled:` entries in the same mapping with one.',
    },
    [YAML_RULES.anchors]: {
        description: 'Aliases name preceding anchors in the same document, and every anchor has a use.',
        why: 'An undefined alias has no value, and an unused anchor adds misleading structure.',
        fix: 'Declare the anchor before its alias, or remove the unused anchor.',
        example: '`timeout: &request-timeout 30` followed by `retry_timeout: *request-timeout` shares one value.',
    },
    [YAML_RULES.truthy]: {
        description: 'Boolean-looking strings are quoted, and booleans use lowercase true or false.',
        why: 'YAML versions disagree about whether yes, no, on, and off are strings or booleans.',
        fix: YAML_MESSAGES.truthy,
        example: 'Write `answer: "yes"` for a string or `enabled: true` for a boolean.',
    },
    [YAML_RULES.octal]: {
        description: 'Plain numbers have no leading zero or octal prefix.',
        why: 'YAML versions can read the same leading-zero value as different numbers.',
        fix: YAML_MESSAGES.octal,
        example: 'Write `mode: "0755"` when the exact digits matter.',
    },
    [YAML_RULES.documents]: {
        description: 'A file contains one YAML document.',
        why: 'A consumer that reads one document can miss the rest of a stream.',
        fix: YAML_MESSAGES.documents,
        example: 'Split documents separated by `---` into separate files unless the consumer requires a stream.',
    },
    [YAML_RULES.merge]: {
        description: 'Mappings have explicit keys instead of the << merge key.',
        why: 'YAML 1.2 does not define merge keys, and consumers can ignore them.',
        fix: YAML_MESSAGES.merge,
        example: 'Replace `<<: *defaults` with the mapping keys the consumer needs.',
    },
    [YAML_RULES.anchorNames]: {
        description: 'An anchor name describes the value it holds.',
        why: 'Generated names hide the relationship between the anchor and its aliases.',
        fix: 'Rename the anchor and its aliases for their shared value.',
        example: 'Replace `&a1` and `*a1` with `&request-timeout` and `*request-timeout`.',
    },
    [YAML_RULES.version]: {
        description: 'A decimal-looking string with a trailing zero is quoted.',
        why: 'A numeric parser discards the trailing zero of a value such as 1.10.',
        fix: YAML_MESSAGES.version,
        example: 'Write `version: "1.10"` to keep the complete version string.',
    },
    [YAML_RULES.comments]: {
        description: 'Comments sit above the key, except version comments after pinned actions.',
        why: 'A comment above a key stays separate from its value.',
        fix: YAML_MESSAGES.comments,
        example: 'Move `enabled: true # required` to a comment line above `enabled: true`.',
    },
    [YAML_RULES.extension]: {
        description: 'YAML files use .yml unless a consumer names the .yaml file.',
        why: 'One extension keeps file discovery predictable while preserving required tool names.',
        fix: YAML_MESSAGES.extension,
        example: 'Rename `settings.yaml` to `settings.yml`; keep `pnpm-workspace.yaml`.',
    },
} as const satisfies Readonly<Record<string, LintRuleDocs>>;
