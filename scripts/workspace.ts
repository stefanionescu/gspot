import { fileURLToPath } from 'node:url';

/** Resolve this checkout for automation and its child processes, regardless of their working directory. */
export const workspaceRoot = fileURLToPath(new URL('..', import.meta.url));
