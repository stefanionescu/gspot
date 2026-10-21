import { GSPOT_CONFIGURATIONS_PATH } from '#cli/config/gspot-paths.ts';

export const NESTJS_COMPILER_OPTIONS = { experimentalDecorators: true, emitDecoratorMetadata: true } as const;

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

export const JAVASCRIPT_TSC_COMMAND = ['tsc', '-p'] as const;

export const TSC_BUILD_COMMAND = ['tsc', '-b'] as const;

export const TSC_PROJECT_COMMAND = ['tsc', '--noEmit', '-p'] as const;

export const TSC_PLAIN_OUTPUT = ['--pretty', 'false'] as const;

export const JSCONFIG_TSBUILDINFO = 'jsconfig.check.tsbuildinfo';

export const TSCONFIG_TSBUILDINFO = 'tsconfig.tsbuildinfo';

export const TSCONFIG_NAME = /^tsconfig\.(?:.+\.)?json$/u;

export const TSBUILDINFO_FLAG = '--tsBuildInfoFile';

export const TYPESCRIPT_TSC_CHECK = 'typescript/tsc';

export const TSC_TOOL = 'tsc';

export const TSC_REFERENCE_OUTPUT_FOLDER = 'typescript';

export const TSC_REFERENCE_BUNDLE = 'output.js';

export const TSC_CONFIG_INPUT_PATHS = ['extends', 'files', 'include', 'exclude'] as const;

export const TSC_COMPILER_INPUT_PATHS = ['baseUrl', 'rootDir', 'rootDirs', 'typeRoots'] as const;

export const TSC_PATHS_BASE_REQUIRED = 'The compiler did not supply the TypeScript paths base.';

export const TSC_CONFIGURATION_REQUIRED = 'A captured TypeScript configuration is missing.';

export const TYPESCRIPT_TSCONFIG_CHECK = 'typescript/tsconfig';

/** Where a compiler run writes the project file of each scope, below the run folder. */
export const TSCONFIG_COPY_FOLDER = `${GSPOT_CONFIGURATIONS_PATH}/language/typescript`;
