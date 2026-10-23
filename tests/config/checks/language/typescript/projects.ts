/** The type-check flags that the all-level TypeScript policy requires. */
const STRICT_TYPE_FLAGS = {
    strict: true,
    noFallthroughCasesInSwitch: true,
    noUncheckedIndexedAccess: true,
    noImplicitOverride: true,
    exactOptionalPropertyTypes: true,
    noImplicitReturns: true,
    noPropertyAccessFromIndexSignature: true,
} as const;

/** Compiler options that the all-level TypeScript policy requires. */
export const STRICT_COMPILER_OPTIONS = {
    ...STRICT_TYPE_FLAGS,
    target: 'ES2022',
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    types: [],
    skipLibCheck: true,
} as const;

export const STRICT_TSCONFIG_TEXT = JSON.stringify({ compilerOptions: STRICT_TYPE_FLAGS });

export const COMPILER_SOURCE = 'export const value = missing;\n';

/** An ignore of the noImplicitReturns option of typescript/tsconfig. */
export const IMPLICIT_RETURNS_IGNORE =
    '[[ignore]]\ncheck = "typescript/tsconfig"\nrule = "noImplicitReturns"\nreason = "Returns are checked separately."\n';
