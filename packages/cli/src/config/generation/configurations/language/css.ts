import type { StylelintComponent } from '#cli/types/generation/css.ts';

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

export const STYLELINT_RULE_NAMES_FILE = 'configurations/language/css/stylelint-rule-names.json';

export const STYLELINT_BASE_RULES = { 'import-notation': 'string', 'function-no-unknown': true } as const;

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

export const STYLELINT_DEFAULT_LEVEL_OFF: ReadonlySet<string> = new Set([
    'no-descending-specificity',
    'container-name-pattern',
    'custom-media-pattern',
    'custom-property-pattern',
    'declaration-block-no-redundant-longhand-properties',
    'keyframes-name-pattern',
    'layer-name-pattern',
    'number-max-precision',
    'selector-class-pattern',
    'selector-id-pattern',
    'selector-not-notation',
]);

export const STYLELINT_COMPONENTS: readonly StylelintComponent[] = [
    VUE_STYLELINT_OVERRIDE,
    SVELTE_STYLELINT_OVERRIDE,
    { files: ['**/*.astro'], customSyntax: 'postcss-html', ignorePseudoClasses: [] },
];

export const STYLELINT_CHECK = 'css/stylelint';
