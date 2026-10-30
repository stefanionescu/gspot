import { GSPOT_PATHS } from '#cli/config/files/gspot.ts';

export const TSC_REFERENCE_OUTPUT_FOLDER = 'typescript';

export const TSC_CONFIG_INPUT_PATHS = ['extends', 'files', 'include', 'exclude'] as const;

export const TSC_COMPILER_INPUT_PATHS = ['baseUrl', 'rootDir', 'rootDirs', 'typeRoots'] as const;

export const TSC_REFERENCE_BUNDLE = 'output.js';

export const TSCONFIG_TSBUILDINFO = 'tsconfig.tsbuildinfo';

export const TSBUILDINFO_FLAG = '--tsBuildInfoFile';

export const TSC_BUILD_COMMAND = ['tsc', '-b'] as const;

export const TSC_PROJECT_COMMAND = ['tsc', '--noEmit', '-p'] as const;

export const TSCONFIG_COPY_FOLDER = `${GSPOT_PATHS.configurations}/language/typescript`;

export const TSC_UNFORMATTED_OUTPUT = ['--pretty', 'false'] as const;

export const TYPESCRIPT_TAG = 'typescript';

export const PARENT_TSCONFIG_SKIP = 'The tsconfig of a parent folder covers this project, and gspot checks it there.';

export const TYPESCRIPT_DEFAULTS = {
    target: 'ES2022',
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    jsx: 'preserve',
    resolveJsonModule: true,
    noEmit: true,
} as const;

export const DEFAULT_LEVEL_OPTIONS = { strict: true } as const;

export const COMPILER_OPTIONS = {
    ...DEFAULT_LEVEL_OPTIONS,
    noUncheckedIndexedAccess: true,
    exactOptionalPropertyTypes: true,
    noImplicitOverride: true,
    noFallthroughCasesInSwitch: true,
    noImplicitReturns: true,
    noPropertyAccessFromIndexSignature: true,
} as const;

export const NESTJS_COMPILER_OPTIONS = { experimentalDecorators: true, emitDecoratorMetadata: true } as const;

export const TYPESCRIPT_TSCONFIG_CHECK = 'typescript/tsconfig';
