/** The pinned linter packages that the task installs, and the name list that each one gives. */
export const LINTER_PACKAGES = {
    eslint: {
        module: 'eslint/use-at-your-own-risk',
        nameList: { file: 'configurations/language/javascript/eslint-rule-names.json', source: 'builtinRules' },
    },
    globals: {
        module: 'globals',
        nameList: { file: 'configurations/language/javascript/eslint-global-names.json', source: 'default' },
    },
    stylelint: {
        module: 'stylelint',
        nameList: { file: 'configurations/language/css/stylelint-rule-names.json', source: 'resolveConfig.rules' },
    },
    standard: { module: 'stylelint-config-standard' },
    prettier: { module: 'prettier' },
} as const;

/** The temporary folder where the task installs the pinned linters. */
export const LINTER_INSTALL_FOLDER = {
    manifest: 'package.json',
    install: ['bun', 'install', '--ignore-scripts'],
    sample: 'capture.css',
    testsManifest: '../../../../tests/package.json',
} as const;

/** The fields of a preset block that the task copies; parser and plugin objects stay out. */
export const PRESET_BLOCK_KEYS = ['files', 'ignores', 'basePath', 'rules'] as const;
