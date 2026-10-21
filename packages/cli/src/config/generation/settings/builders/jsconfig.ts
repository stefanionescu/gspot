/** JavaScript for a bundler resolves imports without Node file suffixes. */
export const JAVASCRIPT_BUNDLED_IMPORTS = { module: 'ESNext', moduleResolution: 'Bundler' } as const;

export const JAVASCRIPT_EXTENSIONS = ['js', 'mjs', 'cjs', 'jsx'] as const;

export const JAVASCRIPT_IGNORED_GLOBS = [
    '**/eslint.config.mjs',
    '**/eslint.config.js',
    '**/eslint.config.cjs',
] as const;

/** Resolution defaults used only when the repository has no jsconfig. */
export const JAVASCRIPT_IMPORTS = {
    target: 'ES2022',
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    jsx: 'preserve',
    skipLibCheck: true,
    resolveJsonModule: true,
} as const;

/** JavaScript checks keep the module resolution of an existing jsconfig. */
export const JAVASCRIPT_OPTIONS = {
    checkJs: true,
    allowJs: true,
    strict: true,
    noEmit: true,
    // JavaScript that a runtime such as Bun or Node.js runs may import TypeScript files by their extension.
    allowImportingTsExtensions: true,
    maxNodeModuleJsDepth: 0,
} as const;

export const SOURCE_SELECTION_FIELDS = ['files', 'include'] as const;
