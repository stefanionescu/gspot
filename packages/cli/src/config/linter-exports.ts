export const INSTALL_PROJECT = {
    manifest: 'package.json',
    install: ['bun', 'install', '--ignore-scripts'],
    sample: 'capture.css',
    testsManifest: '../../tests/package.json',
} as const;

export const LINTER_PACKAGES = {
    eslint: {
        module: 'eslint/use-at-your-own-risk',
    },
    globals: {
        module: 'globals',
    },
    stylelint: {
        module: 'stylelint',
    },
    standard: { module: 'stylelint-config-standard' },
    prettier: { module: 'prettier' },
} as const;

export const PRESET_BLOCK_KEYS = ['files', 'ignores', 'basePath', 'rules'] as const;
