export const LINTER_PACKAGES = {
    eslint: {
        module: 'eslint/use-at-your-own-risk',
        nameList: { file: 'configurations/language/javascript/eslint-rule-names.json' },
    },
    globals: {
        module: 'globals',
        nameList: { file: 'configurations/language/javascript/eslint-global-names.json' },
    },
    stylelint: {
        module: 'stylelint',
        nameList: { file: 'configurations/language/css/stylelint-rule-names.json' },
    },
    standard: { module: 'stylelint-config-standard' },
    prettier: { module: 'prettier' },
} as const;

export const LINTER_INSTALL_FOLDER = {
    manifest: 'package.json',
    install: ['bun', 'install', '--ignore-scripts'],
    sample: 'capture.css',
    testsManifest: '../../../../tests/package.json',
} as const;

export const PRESET_BLOCK_KEYS = ['files', 'ignores', 'basePath', 'rules'] as const;
