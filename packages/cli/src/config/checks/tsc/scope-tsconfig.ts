export const TYPESCRIPT_DEFAULTS = {
    target: 'ES2022',
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    jsx: 'preserve',
    resolveJsonModule: true,
    noEmit: true,
} as const;

export const RECOMMENDED_OPTIONS = { strict: true } as const;

export const COMPILER_OPTIONS = {
    ...RECOMMENDED_OPTIONS,
    noUncheckedIndexedAccess: true,
    exactOptionalPropertyTypes: true,
    noImplicitOverride: true,
    noFallthroughCasesInSwitch: true,
    noImplicitReturns: true,
    noPropertyAccessFromIndexSignature: true,
} as const;

export const NESTJS_COMPILER_OPTIONS = { experimentalDecorators: true, emitDecoratorMetadata: true } as const;

export const TYPESCRIPT_TSCONFIG_CHECK = 'typescript/tsconfig';
