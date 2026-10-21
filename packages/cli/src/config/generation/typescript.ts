/**
 * Compiler flags that add errors and change neither module resolution nor the JavaScript output. Level recommended asks
 * for strict, as the recommended base of tsconfig/bases does; level all adds the flags of its strictest base.
 */
export const RECOMMENDED_OPTIONS = { strict: true } as const;

/** More compiler checks at level all. */
export const COMPILER_OPTIONS = {
    ...RECOMMENDED_OPTIONS,
    noUncheckedIndexedAccess: true,
    exactOptionalPropertyTypes: true,
    noImplicitOverride: true,
    noFallthroughCasesInSwitch: true,
    noImplicitReturns: true,
    noPropertyAccessFromIndexSignature: true,
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

/** Standalone source projects use Node resolution and leave JSX for the project runtime. */
export const TYPESCRIPT_DEFAULTS = {
    target: 'ES2022',
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    jsx: 'preserve',
    resolveJsonModule: true,
    noEmit: true,
} as const;

/** JavaScript for a bundler resolves imports without Node file suffixes. */
export const JAVASCRIPT_BUNDLED_IMPORTS = { module: 'ESNext', moduleResolution: 'Bundler' } as const;

export const NESTJS_COMPILER_OPTIONS = { experimentalDecorators: true, emitDecoratorMetadata: true } as const;
