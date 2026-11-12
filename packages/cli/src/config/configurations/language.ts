import type { StylelintComponent } from '#cli/types/configurations/language.ts';

// css generated config

export const CSS_MODULES_OVERRIDE = {
    files: ['**/*.module.css'],
    suffix: '.module.css',
    rules: {
        'selector-pseudo-class-no-unknown': [
            true,
            { ignorePseudoClasses: ['export', 'import', 'global', 'local', 'external'] },
        ],
        'selector-type-no-unknown': [true, { ignore: ['custom-elements'], ignoreTypes: ['from'] }],
        'property-no-unknown': [
            true,
            { ignoreProperties: ['composes', 'compose-with'], ignoreSelectors: [':export', '/^:import/'] },
        ],
    },
    atRules: ['value'],
} as const;

export const STYLELINT_BASE_RULES = {
    'import-notation': 'string',
    'function-no-unknown': true,
    'property-disallowed-list': ['/^(margin|padding|border|inset)-(left|right)/', 'left', 'right'],
    'declaration-property-value-disallowed-list': {
        float: ['left', 'right'],
        clear: ['left', 'right'],
        'text-align': ['left', 'right'],
        outline: ['none', '0'],
    },
    'declaration-property-unit-allowed-list': { 'font-size': ['rem', 'em', '%'] },
    'selector-max-id': 0,
    'selector-max-specificity': '0,3,0',
    'selector-disallowed-list': [String.raw`/^\.(is|has)-[\w-]+$/`],
} as const;

const SVELTE_STYLELINT_OVERRIDE = {
    files: ['**/*.svelte'],
    customSyntax: 'postcss-html',
    ignorePseudoClasses: ['global'],
} as const;

const VUE_STYLELINT_OVERRIDE = {
    files: ['**/*.vue'],
    customSyntax: 'postcss-html',
    ignorePseudoClasses: ['deep', 'global', 'slotted'],
    functions: ['v-bind'],
} as const;

export const STYLELINT_COMPONENTS: readonly StylelintComponent[] = [
    VUE_STYLELINT_OVERRIDE,
    SVELTE_STYLELINT_OVERRIDE,
    { files: ['**/*.astro'], customSyntax: 'postcss-html', ignorePseudoClasses: ['global'] },
];

export const TAILWIND_AT_RULES = [
    'tailwind',
    'apply',
    'layer',
    'theme',
    'utility',
    'variant',
    'custom-variant',
    'source',
    'plugin',
    'config',
    'reference',
] as const;

// import paths

export const PATH_SEPARATOR_PATTERN = String.raw`[/\\]`;

// sql generated config

export const SQLFLUFF_CAPITALISATION = {
    'capitalisation.keywords': { capitalisation_policy: 'upper' },
    'capitalisation.identifiers': { extended_capitalisation_policy: 'lower' },
    'capitalisation.functions': { extended_capitalisation_policy: 'lower' },
    'capitalisation.literals': { capitalisation_policy: 'upper' },
    'capitalisation.types': { extended_capitalisation_policy: 'upper' },
} as const;

export const SQL_FILES = ['**/*.sql', '**/*.pgsql', '**/*.psql'] as const;

// toml generated config

export const TAPLO_FORMATTING = {
    array_auto_expand: false,
    array_auto_collapse: false,
} as const;

// yaml checks

export const YAML_COMMIT_USE = /^\s*(?:-\s+)?uses:\s*['"]?[^'"#\s]+@[\da-f]{40}['"]?\s*$/iu;

export const YAML_GENERATED_ANCHOR = /^[a-z]?\d+$/iu;

export const YAML_LEADING_ZERO = /^[+-]?(?:0\d+|0o[0-7]+)$/u;

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

export const YAML_TRAILING_ZERO = /^[+-]?\d+\.\d*0$/u;

export const YAML_TRUTHY = /^(?:[Yy][Ee][Ss]|[Nn][Oo]|[Oo][Nn]|[Oo][Ff][Ff]|True|TRUE|False|FALSE)$/u;

export const YAML_VERSION_COMMENT = /^#\s*v?\d+(?:\.\d+)*(?:[-+][\w.-]+)?\s*$/u;
