import type { StylelintComponent } from '#cli/types/configurations/language.ts';

const VUE_STYLELINT_OVERRIDE = {
    files: ['**/*.vue'],
    customSyntax: 'postcss-html',
    ignorePseudoClasses: ['deep', 'global', 'slotted'],
    functions: ['v-bind'],
} as const;

const SVELTE_STYLELINT_OVERRIDE = {
    files: ['**/*.svelte'],
    customSyntax: 'postcss-html',
    ignorePseudoClasses: ['global'],
} as const;

export const STYLELINT_COMPONENTS: readonly StylelintComponent[] = [
    VUE_STYLELINT_OVERRIDE,
    SVELTE_STYLELINT_OVERRIDE,
    { files: ['**/*.astro'], customSyntax: 'postcss-html', ignorePseudoClasses: ['global'] },
];

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
