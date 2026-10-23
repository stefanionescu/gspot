export const JAVASCRIPT_BUNDLED_IMPORTS = { module: 'ESNext', moduleResolution: 'Bundler' } as const;

export const JAVASCRIPT_EXTENSIONS = ['js', 'mjs', 'cjs', 'jsx'] as const;

export const JAVASCRIPT_IGNORED_GLOBS = [
    '**/eslint.config.mjs',
    '**/eslint.config.js',
    '**/eslint.config.cjs',
] as const;

export const JAVASCRIPT_IMPORTS = {
    target: 'ES2022',
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    jsx: 'preserve',
    skipLibCheck: true,
    resolveJsonModule: true,
} as const;

export const JAVASCRIPT_OPTIONS = {
    checkJs: true,
    allowJs: true,
    strict: true,
    noEmit: true,
    allowImportingTsExtensions: true,
    maxNodeModuleJsDepth: 0,
} as const;

export const SOURCE_SELECTION_FIELDS = ['files', 'include'] as const;
