/** Compiler flags that add diagnostics without changing module resolution or emitted JavaScript. */
export const RECOMMENDED_OPTIONS = {
    strict: true,
    noUncheckedIndexedAccess: true,
    exactOptionalPropertyTypes: true,
    noImplicitOverride: true,
    noFallthroughCasesInSwitch: true,
} as const;

/** Additional compiler diagnostics required at all. */
export const COMPILER_OPTIONS = {
    ...RECOMMENDED_OPTIONS,
    noImplicitReturns: true,
    noPropertyAccessFromIndexSignature: true,
} as const;

/** JavaScript source checks preserve resolution from the author's existing jsconfig. */
export const JAVASCRIPT_OPTIONS = {
    checkJs: true,
    allowJs: true,
    strict: true,
    noEmit: true,
    maxNodeModuleJsDepth: 0,
} as const;

/** Resolution defaults used only when the repository has no jsconfig. */
export const JAVASCRIPT_IMPORTS = {
    target: 'ES2022',
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    jsx: 'preserve',
    skipLibCheck: true,
    resolveJsonModule: true,
} as const;

export const JAVASCRIPT_EXCLUSIONS = ['**/eslint.config.mjs', '**/eslint.config.js', '**/eslint.config.cjs'] as const;

export const JAVASCRIPT_EXTENSIONS = ['js', 'mjs', 'cjs', 'jsx'] as const;

/** Standalone source projects use native Node resolution and leave JSX for the project runtime. */
export const TYPESCRIPT_DEFAULTS = {
    target: 'ES2022',
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    jsx: 'preserve',
    resolveJsonModule: true,
    noEmit: true,
} as const;

/** Bundled JavaScript resolves imports without requiring emitted Node suffixes. */
export const JAVASCRIPT_BUNDLED_IMPORTS = { module: 'ESNext', moduleResolution: 'Bundler' } as const;

export const NESTJS_COMPILER_OPTIONS = { experimentalDecorators: true, emitDecoratorMetadata: true } as const;
export const NESTJS_CONFIGURATION = 'nestjs';
