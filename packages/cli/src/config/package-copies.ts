export const PRESET_BLOCK_KEYS = ['files', 'ignores', 'basePath', 'rules'] as const;
export const PACKAGE_COPY_MODULES = {
    eslint: 'eslint/use-at-your-own-risk',
    globals: 'globals',
    stylelint: 'stylelint',
    standard: 'stylelint-config-standard',
    prettier: 'prettier',
} as const;
export const PACKAGE_COPY_FILES = {
    eslint: 'configurations/language/javascript/eslint-rule-names.json',
    globals: 'configurations/language/javascript/eslint-runtime-names.json',
    stylelint: 'configurations/language/css/stylelint-rule-names.json',
} as const;
export const PACKAGE_COPY_SOURCES = {
    eslint: 'builtinRules',
    globals: 'default',
    stylelint: 'resolveConfig.rules',
} as const;
export const PACKAGE_COPY_INSTALL = ['bun', 'install', '--ignore-scripts'] as const;
export const PACKAGE_COPY_SAMPLE = 'capture.css';
export const PACKAGE_COPY_DOCUMENT = 'package.json';

export const PACKAGE_COPY_TESTS_FILE = '../../../../tests/package.json';
