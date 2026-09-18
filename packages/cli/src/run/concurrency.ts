// The per-stage limit, and the fixer order under --fix.
import pLimit from 'p-limit';
import { cpus } from 'node:os';
import type { FixOrder } from '#types/manifest.ts';
import { jobsWanted } from '#cli/platform/environment.ts';

export const FIX_ORDER: FixOrder[] = ['codemod', 'imports', 'manifest', 'format'];

/**
 * A limiter sized to the CPU count, or the count an environment variable names.
 * @returns the limiter
 */
export function stageLimiter(): ReturnType<typeof pLimit> {
    return pLimit(jobsWanted() ?? Math.max(1, cpus().length));
}

/**
 * Sorts fixable items by their fixer order.
 * @param items the items, each with a fixer order
 * @returns the items in fixer order
 */
export function byFixOrder<T extends { order: FixOrder | undefined }>(items: T[]): T[] {
    return [...items].toSorted(
        (a, b) => FIX_ORDER.indexOf(a.order ?? 'format') - FIX_ORDER.indexOf(b.order ?? 'format'),
    );
}
