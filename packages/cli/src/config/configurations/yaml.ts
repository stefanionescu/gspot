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
