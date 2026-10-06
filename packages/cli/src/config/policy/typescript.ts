/** Compiler flags that add diagnostics without changing module resolution or emitted JavaScript. */
export const RECOMMENDED_OPTIONS = {
    strict: true,
    noUncheckedIndexedAccess: true,
    exactOptionalPropertyTypes: true,
    noImplicitOverride: true,
    noFallthroughCasesInSwitch: true,
};

/** Additional compiler diagnostics required at all. */
export const COMPILER_OPTIONS = {
    ...RECOMMENDED_OPTIONS,
    noImplicitReturns: true,
    noPropertyAccessFromIndexSignature: true,
};

// Nest injects by the emitted types of constructor parameters, which takes both decorator options.
export const DECORATOR_OPTIONS = { experimentalDecorators: true, emitDecoratorMetadata: true };
