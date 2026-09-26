// What a test expects: the error a call fails with, and a matcher typed as the value it stands in for. Bun types
// every asymmetric matcher as any, so the three matcher functions name the type the comparison expects.
import { expect } from 'bun:test';

/**
 * Awaits a promise that must reject with an error.
 * @param promise the promise expected to reject
 * @returns the message of the error it rejected with
 */
export async function rejection(promise: Promise<unknown>): Promise<string> {
    let settled: { rejected: true; error: unknown } | { rejected: false } = { rejected: false };
    try {
        await promise;
    } catch (error) {
        settled = { rejected: true, error };
    }
    if (!settled.rejected) throw new Error('The promise resolved, and a rejection was expected.');
    if (!(settled.error instanceof Error))
        throw new Error(`The promise rejected with a value that is not an error: ${String(settled.error)}`);
    return settled.error.message;
}

/**
 * Runs an action that may throw and hands back what it threw.
 * @param action the call under test
 * @returns the error it threw, or undefined when it returned
 */
export function failure(action: () => unknown): Error | undefined {
    try {
        action();
    } catch (error) {
        if (error instanceof Error) return error;
        throw new Error(`The action threw a value that is not an error: ${String(error)}`);
    }
    return undefined;
}

/**
 * An object that must hold these properties, typed as the compared value.
 * @param shape the properties the compared object must hold
 * @returns the matcher
 */
// eslint-disable-next-line gspot/no-trivial-functions -- Bun types its matcher as any; this names the type the comparison expects
export function containing<T>(shape: NoInfer<Partial<T>>): T {
    return expect.objectContaining(shape) as T;
}

/**
 * An array that must hold these items, typed as the compared value.
 * @param items the items the compared array must hold
 * @returns the matcher
 */
// eslint-disable-next-line gspot/no-trivial-functions -- Bun types its matcher as any; this names the type the comparison expects
export function containingAll<T>(items: NoInfer<T[]>): T[] {
    return expect.arrayContaining(items) as T[];
}

/**
 * Text that must hold this part, typed as a string.
 * @param part the text the compared string must hold
 * @returns the matcher
 */
// eslint-disable-next-line gspot/no-trivial-functions -- Bun types its matcher as any; this names the type the comparison expects
export function textContaining(part: string): string {
    return expect.stringContaining(part) as string;
}
