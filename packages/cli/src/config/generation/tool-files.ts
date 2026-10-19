import { LOCKFILES } from '#cli/config/parsers/lockfiles.ts';
import { GIT_FOLDER, NODE_MODULES } from '#cli/config/repository/tracked.ts';
import { DOT_GSPOT, MISE_TOOL_PROJECT_FILE } from '#cli/config/system/locations.ts';

const COMMITLINT_ERROR_SEVERITY = 2;

const COMMIT_LINE_LENGTH = 72;

/** Generated identifiers that contain no spelling words. */
export const TYPOS_IGNORE_PATTERNS = [
    String.raw`\b[0-9a-f]{7,40}\b`,
    String.raw`\b[A-Za-z0-9+/]{40,}={0,2}\b`,
] as const;

/** Dependency and generated formats that typos must not read. */
export const TYPOS_EXCLUDED_FILES = [
    '*.lock',
    ...LOCKFILES.map(({ file }) => file).filter((file) => !file.endsWith('.lock')),
    '*.pbxproj',
    '*.xcstrings',
    '*.svg',
    '*.min.js',
    '*.min.css',
];

export const HADOLINT_RECOMMENDED_OFF = [
    'DL3001',
    'DL3003',
    'DL3008',
    'DL3010',
    'DL3018',
    'DL3020',
    'DL3048',
    'DL4001',
] as const;

export const SPECTRAL_RECOMMENDED_OFF = [
    'info-contact',
    'info-description',
    'operation-description',
    'operation-tags',
] as const;

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

export const SQUAWK_RECOMMENDED_OFF = [
    'prefer-bigint-over-int',
    'prefer-bigint-over-smallint',
    'prefer-identity',
    'prefer-text-field',
    'require-table-schema',
] as const;

export const TRIVY_SKIPPED_FOLDERS = [NODE_MODULES, DOT_GSPOT, GIT_FOLDER] as const;

export const SHELLCHECK_CHECKS = [
    'check-extra-masked-returns',
    'check-set-e-suppressed',
    'check-unassigned-uppercase',
] as const;

export const SHELLCHECK_ALL_LEVEL_CHECKS = [
    'add-default-case',
    'avoid-negated-conditions',
    'avoid-nullary-conditions',
    'deprecate-which',
    'quote-safe-variables',
    'require-double-brackets',
    'require-variable-braces',
    'useless-use-of-cat',
] as const;

/** The mise file patterns accepted by v8r. */
export const MISE_SCHEMA = {
    name: 'mise',
    description: 'The mise configuration file',
    fileMatch: [
        'mise.toml',
        '.mise.toml',
        '.mise/conf.d/*.toml',
        '.config/mise/config.toml',
        '.config/mise/conf.d/*.toml',
        MISE_TOOL_PROJECT_FILE,
    ],
    location: 'https://mise.jdx.dev/schema/mise.json',
} as const;

export const STYLELINT_ALL_LEVEL_RULES: ReadonlySet<string> = new Set([
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

/** CSS Modules syntax, as stylelint-config-css-modules 4.6.0 accepts it: composes, :global and :export, and @value. */
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

export const STYLELINT_BASE_RULES = { 'no-descending-specificity': true, 'import-notation': 'string' } as const;

export const SWIFT_TOOLS_VERSION = /^\s*\/\/\s*swift-tools-version\s*:\s*(\d+(?:\.\d+){1,2})\b/u;

export const STYLELINT_RULE_NAMES_FILE = 'configurations/language/css/stylelint-rule-names.json';

export const PURGECSS_EXTRACTOR = /[\w/:-]+/gu;
export const PURGECSS_TOKEN_END = ':';

export const PURGECSS_PSEUDO_CLASS_PATTERN = /^:[\w-]+$/u;

export const COMMITLINT_RULES = {
    'type-case': [COMMITLINT_ERROR_SEVERITY, 'always', 'lower-case'],
    'type-empty': [COMMITLINT_ERROR_SEVERITY, 'never'],
    'scope-case': [COMMITLINT_ERROR_SEVERITY, 'always', 'kebab-case'],
    'subject-empty': [COMMITLINT_ERROR_SEVERITY, 'never'],
    'subject-full-stop': [COMMITLINT_ERROR_SEVERITY, 'never', '.'],
    'subject-case': [COMMITLINT_ERROR_SEVERITY, 'never', ['start-case', 'pascal-case', 'upper-case']],
    'header-max-length': [COMMITLINT_ERROR_SEVERITY, 'always', COMMIT_LINE_LENGTH],
    'body-leading-blank': [COMMITLINT_ERROR_SEVERITY, 'always'],
    'body-max-line-length': [COMMITLINT_ERROR_SEVERITY, 'always', COMMIT_LINE_LENGTH],
    'footer-leading-blank': [COMMITLINT_ERROR_SEVERITY, 'always'],
} as const;

export const JSCPD_IGNORED = ['**/*.md', '**/*.mdx'] as const;

export const TAPLO_FORMATTING = {
    align_entries: false,
    reorder_keys: false,
    array_auto_expand: false,
    array_auto_collapse: false,
} as const;

export const YAMLLINT_YAML_OPTIONS = { version: '1.1' } as const;

export const YAMLLINT_RULE_OPTIONS = {
    comments: { 'min-spaces-from-content': 1 },
    truthy: { 'check-keys': false },
    braces: { 'max-spaces-inside': 1 },
    brackets: { 'max-spaces-inside': 1 },
    indentation: { spaces: 'consistent', 'indent-sequences': 'consistent' },
} as const;

export const HADOLINT_FAILURE_THRESHOLD = 'style';

export const SHELLCHECK_OPTIONS = [
    ['source-path', 'SCRIPTDIR'],
    ['external-sources', 'true'],
] as const;

export const KNIP_SCHEMA_URL = 'https://unpkg.com/knip@6/schema.json';

export const KNIP_IGNORED_DEPENDENCIES = ['@gspothq/cli'] as const;

export const KNIP_ENTRY_SETTING = 'entry';

/** The Markdownlint CLI configuration, with its JSON report formatter. */
export const MARKDOWNLINT_CLI_TEXT = `import { fileURLToPath } from 'node:url';

export default {
    config: { extends: fileURLToPath(new URL('markdownlint.jsonc', import.meta.url)) },
    noBanner: true,
    noProgress: true,
    outputFormatters: [
        [
            /**
             * Write the findings as JSON.
             * @param {object} output the formatter input.
             * @param {unknown} output.results the findings.
             * @param {(message: string) => void} output.logMessage the report writer.
             * @returns {void} nothing.
             */
            ({ results, logMessage }) => logMessage(JSON.stringify(results)),
        ],
    ],
};
`;

export const MARKDOWNLINT_RULES = {
    default: true,
    MD013: false,
    MD033: false,
    MD024: { siblings_only: true },
    MD046: { style: 'fenced' },
    MD048: { style: 'backtick' },
    MD049: { style: 'underscore' },
    MD050: { style: 'asterisk' },
} as const;

export const SQLFLUFF_RECOMMENDED_OFF = ['AM05', 'AM09', 'CV11', 'ST05', 'ST07', 'ST09'] as const;

export const SQL_FILE_EXTENSIONS = '.sql,.pgsql,.psql';

export const SQLFLUFF_CAPITALISATION = {
    'capitalisation.keywords': { capitalisation_policy: 'upper' },
    'capitalisation.identifiers': { extended_capitalisation_policy: 'lower' },
    'capitalisation.functions': { extended_capitalisation_policy: 'lower' },
    'capitalisation.literals': { capitalisation_policy: 'upper' },
    'capitalisation.types': { extended_capitalisation_policy: 'upper' },
} as const;

export const TOML_FORMAT = { inlineTableStart: Number.MAX_SAFE_INTEGER, bracketSpacing: false } as const;

/** The first lines of a tool file that also exists to keep the tool from reading another file. */
export const TOOL_FILE_NOTES = {
    lychee: [
        '# This file stops lychee from reading a lychee.toml in the folder where it runs.',
        '# Allow a URL with the docs.allowed_urls setting.',
    ],
    osvScanner: [
        '# This file stops OSV-Scanner from reading an osv-scanner.toml next to a lockfile.',
        '# Accept a vulnerability with gspot ignore dependencies/osv-scanner --rule <ID> and a reason.',
    ],
} as const;

export const KNIP_JAVASCRIPT_ENTRY_FILES = ['src/main.{ts,js}', 'src/index.{ts,js}'] as const;

/** Preview Ansible rules stay disabled at both levels. */
export const ALWAYS_SKIPPED_TAGS = ['experimental'] as const;

export { COMMITLINT_ERROR_SEVERITY };

export const TYPOS_EXCLUDED_ARRAY = /^extend-exclude = .+$/mu;

export const STYLELINT_TOOL = 'stylelint';

export const SVELTE_STYLELINT_OVERRIDE = {
    files: ['**/*.svelte'],
    customSyntax: 'postcss-html',
    ignorePseudoClasses: ['global'],
} as const;

export const VUE_STYLELINT_OVERRIDE = {
    files: ['**/*.vue'],
    customSyntax: 'postcss-html',
    ignorePseudoClasses: ['deep', 'global', 'slotted'],
    functions: ['v-bind'],
} as const;
