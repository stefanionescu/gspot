export const TSC_FAILURE_OUTPUT = 'src/app/page.ts(1,1): error TS2322: Type mismatch\n';

export const NEXT_VERSION_OUTPUT = 'Next.js v16.3.5';

export const TYPESCRIPT_VERSION_OUTPUT = 'Version 5.9.3';

export const NEXT_CACHE_BYTES = [0, 255, 1, 2] as const;

/** The Next.js output folders that a check keeps. */
export const OUTPUT_PRESERVATION_CASES = [
    { name: 'root', scope: '' },
    { name: 'app', scope: 'app' },
] as const;
