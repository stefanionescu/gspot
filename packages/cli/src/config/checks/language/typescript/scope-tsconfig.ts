/** Standalone source projects use Node resolution and leave JSX for the project runtime. */
export const TYPESCRIPT_DEFAULTS = {
    target: 'ES2022',
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    jsx: 'preserve',
    resolveJsonModule: true,
    noEmit: true,
} as const;

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

export const NESTJS_CONFIGURATION = 'nestjs';

export const NESTJS_COMPILER_OPTIONS = { experimentalDecorators: true, emitDecoratorMetadata: true } as const;

export const TYPESCRIPT_TSCONFIG_CHECK = 'typescript/tsconfig';
