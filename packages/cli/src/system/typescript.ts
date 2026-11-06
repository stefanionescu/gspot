import { createRequire } from 'node:module';

import type ts from 'typescript';

const requireModule = createRequire(import.meta.url);

/**
Require the TypeScript compiler when a caller first needs it. It takes a large part of the start time, so commands that
parse no TypeScript, JavaScript, or tsconfig file skip it.
*/
export function requireTypescript(): typeof ts {
    return requireModule('typescript') as typeof ts;
}
