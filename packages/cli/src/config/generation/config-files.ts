import { GSPOT_FOLDER } from '#cli/config/files/gspot.ts';

export const SEMGREP_RULE_PACK_FILE = 'semgrep.yml';

export const CONFIG_FILE_REFERENCE = /(?:['"]\.\/|\bnew\s+URL\(\s*['"])(?<path>[^'"]+)['"]/gu;

export const TS_EXTENSION = '.ts';

export const GIXY_CHECK = 'nginx/gixy';

export const ANSIBLE_LINT_ALWAYS_OFF = ['experimental'] as const;

export const ANSIBLE_LINT_CHECK = 'ansible/ansible-lint';

export const CONFIG_FILE_SCOPES_FOLDER = 'scopes';

export const HTML_VALIDATE_EXTENDS = ['html-validate:recommended'] as const;

export const HTML_DEFAULT_LEVEL_OFF = ['no-inline-style', 'prefer-button', 'prefer-native-element'] as const;

export const HTML_RULES = {
    'doctype-style': ['error', { style: 'lowercase' }],
    'void-style': ['error', { style: 'selfclosing' }],
} as const;

export const HTML_VALIDATE_OVERRIDES: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
    site: {
        'no-inline-style': 'off',
        'no-raw-characters': 'off',
        'void-style': 'off',
        'doctype-style': 'off',
        'no-trailing-whitespace': 'off',
        'valid-id': ['error', { relaxed: true }],
    },
};

export const BUILD_OUTPUT_FOLDERS: ReadonlySet<string> = new Set(['.build', 'DerivedData']);

export const BUILD_OUTPUT_PATTERNS = ['dist/', 'build/', 'coverage/'] as const;

export const GSPOT_FOLDER_PATTERNS = [`${GSPOT_FOLDER}/**`] as const;

export const IGNORE_SECTION_TITLES = {
    build: 'Build output',
    gspot: 'Files that gspot generates',
    generators: 'Generator outputs',
    configurations: 'Paths that configurations leave out',
    lockfiles: 'Lockfiles',
} as const;

export const TARGET_PLACEHOLDER = /\{target_(?:json|module)\}/gu;

export const TARGET_MODULE_PLACEHOLDER = '{target_module}';

export const OVERRIDES_PLACEHOLDER = '{overrides_json}';
