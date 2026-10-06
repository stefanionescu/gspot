/** JavaScript source checks preserve the author's resolution when a jsconfig is present. */
export const JAVASCRIPT_OPTIONS = { checkJs: true, allowJs: true, strict: true, noEmit: true };

/** Resolution defaults used only when the repository has no jsconfig. */
export const JAVASCRIPT_IMPORTS = {
    target: 'ES2022',
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    skipLibCheck: true,
    resolveJsonModule: true,
};

export const JAVASCRIPT_EXCLUSIONS = ['**/eslint.config.mjs', '**/eslint.config.js', '**/eslint.config.cjs'];

export const JAVASCRIPT_EXTENSIONS = ['js', 'mjs', 'cjs', 'jsx'];

/** Standalone source projects use native Node resolution and leave JSX for the project runtime. */
export const TYPESCRIPT_DEFAULTS = {
    target: 'ES2022',
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    jsx: 'preserve',
    resolveJsonModule: true,
    noEmit: true,
};
