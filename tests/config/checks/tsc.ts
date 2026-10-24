const COMPILER_OPTIONS = {
    target: 'ES2022',
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    jsx: 'preserve',
    resolveJsonModule: true,
    noEmit: true,
    strict: true,
    noUncheckedIndexedAccess: true,
    exactOptionalPropertyTypes: true,
    noImplicitOverride: true,
    noFallthroughCasesInSwitch: true,
    noPropertyAccessFromIndexSignature: true,
} as const;

export const DEFAULT_TSCONFIG_PROJECTS = [
    {
        scope: '',
        config: {
            compilerOptions: {
                ...COMPILER_OPTIONS,
                typeRoots: ['node_modules/@types'],
            },
            files: ['../../source.ts'],
        },
    },
    {
        scope: 'service',
        config: {
            compilerOptions: {
                ...COMPILER_OPTIONS,
                experimentalDecorators: true,
                emitDecoratorMetadata: true,
                typeRoots: ['service/node_modules/@types', 'node_modules/@types'],
            },
            files: ['../../../service/source.ts'],
        },
    },
] as const;
