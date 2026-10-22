import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';

export const TSC_REFERENCE_OUTPUT_FOLDER = 'typescript';

export const TSC_PATHS_BASE_REQUIRED = 'The compiler did not supply the TypeScript paths base.';

export const TSC_CONFIG_INPUT_PATHS = ['extends', 'files', 'include', 'exclude'] as const;

export const TSC_COMPILER_INPUT_PATHS = ['baseUrl', 'rootDir', 'rootDirs', 'typeRoots'] as const;

export const TSC_REFERENCE_BUNDLE = 'output.js';

export const TSCONFIG_TSBUILDINFO = 'tsconfig.tsbuildinfo';

export const TSBUILDINFO_FLAG = '--tsBuildInfoFile';

export const TSC_BUILD_COMMAND = ['tsc', '-b'] as const;

export const TSC_PROJECT_COMMAND = ['tsc', '--noEmit', '-p'] as const;

export const TSC_CONFIGURATION_REQUIRED = 'A captured TypeScript configuration is missing.';

/** Where a compiler run writes the project file of each scope, below the run folder. */
export const TSCONFIG_COPY_FOLDER = `${GSPOT_PATHS.configurations}/language/typescript`;

export const TSC_PLAIN_OUTPUT = ['--pretty', 'false'] as const;
