export const TS_EMPTY_FILES_CODE = 18_002;

export const TS_NO_INPUTS_CODE = 18_003;

export const JSCONFIG_FILE = 'jsconfig.json';
export const TSCONFIG_FILE = 'tsconfig.json';
export const JAVASCRIPT_TSC_COMMAND = ['tsc', '-p'] as const;
export const TSC_BUILD_COMMAND = ['tsc', '-b'] as const;
export const TSC_PROJECT_COMMAND = ['tsc', '--noEmit', '-p'] as const;
export const TSC_PLAIN_OUTPUT = ['--pretty', 'false'] as const;
export const JSCONFIG_TSBUILDINFO = 'jsconfig.check.tsbuildinfo';
export const TSCONFIG_TSBUILDINFO = 'tsconfig.tsbuildinfo';

export const SOURCE_SELECTION_FIELDS = ['files', 'include'] as const;

export const TSCONFIG_NAME = /^tsconfig\.(?:.+\.)?json$/u;
