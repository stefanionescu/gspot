import type ts from 'typescript';
import { createRequire } from 'node:module';

const requireModule = createRequire(import.meta.url);

/**
Require the TypeScript compiler when a caller first needs it. It takes a large part of the start time, so commands that
parse no TypeScript, JavaScript, or tsconfig file skip it.

@returns the compiler module, which Node.js caches after the first load.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Parsers, checks, and generators in several layers load the compiler on first use through it.
export function requireTypescript(): typeof ts {
    return requireModule('typescript') as typeof ts;
}
