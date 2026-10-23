/** tsc output with one error in the page. */
export const TSC_FAILURE_OUTPUT = 'src/app/page.ts(1,1): error TS2322: Type mismatch\n';

/** What `next --version` prints. */
export const NEXT_VERSION_OUTPUT = 'Next.js v16.3.5';

/** What `tsc --version` prints. */
export const TYPESCRIPT_VERSION_OUTPUT = 'Version 5.9.3';

/** An untracked build cache that the check must keep. */
export const NEXT_CACHE_BYTES = [0, 255, 1, 2] as const;

/** The Next.js output folders that a check keeps. */
export const OUTPUT_PRESERVATION_CASES = [
    { name: 'root', scope: '' },
    { name: 'app', scope: 'app' },
] as const;

/** The next-env.d.ts that the project commits. */
export const AUTHORED_NEXT_ENV = '// Authored type declaration\n';

/** The route types in the untracked .next folder. */
export const RETAINED_ROUTE_TYPES = '// Retained route types\n';

/** A file outside the Next.js scope. */
export const UNRELATED_FILE = { path: 'unrelated/private.txt', text: 'Preserve unrelated scope\n' } as const;

/** A launcher that prints the Next.js version. */
export const NEXT_LAUNCHER = '#!/usr/bin/env node\nconsole.log("Next.js v16.3.5");\n';
