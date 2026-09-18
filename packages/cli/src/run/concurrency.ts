// The per-stage limit, and the fixer order under --fix.
import { cpus } from 'node:os';

import pLimit from 'p-limit';

import type { FixOrder } from '#types/manifest.ts';

export const FIX_ORDER: FixOrder[] = ['codemod', 'imports', 'manifest', 'format'];

/** A limiter sized to the CPU count, or the count an environment variable names. */
export function stageLimiter(): ReturnType<typeof pLimit> {
    const wanted = Number(process.env['GSPOT_JOBS'] ?? '');
    const count = Number.isInteger(wanted) && wanted > 0 ? wanted : Math.max(1, cpus().length);
    return pLimit(count);
}

/** Sorts fixable items by their fixer order. */
export function byFixOrder<T extends { order: FixOrder | undefined }>(items: T[]): T[] {
    return [...items].sort((a, b) => FIX_ORDER.indexOf(a.order ?? 'format') - FIX_ORDER.indexOf(b.order ?? 'format'));
}
