// Matcher builders and rejected-promise observations used by tests.
import { expect } from 'bun:test';

/**
 * Awaits a promise that must reject with an error.
 * @param promise the promise expected to reject
 * @returns the message of the error it rejected with
 */
export async function rejection(promise: Promise<unknown>): Promise<string> {
    try {
        await promise;
    } catch (error) {
        if (error instanceof Error) return error.message;
        throw new Error(`The promise rejected with a value that is not an error: ${String(error)}`);
    }
    throw new Error('The promise resolved, and a rejection was expected.');
}

/**
 * An object that must hold these properties, typed as the compared value.
 * @param shape the properties the compared object must hold
 * @returns the matcher
 */

export function containing<T>(shape: NoInfer<Partial<T>>): T {
    return expect.objectContaining(shape) as T;
}

/**
 * An array that must hold these items, typed as the compared value.
 * @param items the items the compared array must hold
 * @returns the matcher
 */

export function containingAll<T>(items: NoInfer<T[]>): T[] {
    return expect.arrayContaining(items) as T[];
}

/**
 * Text that must hold this part, typed as a string.
 * @param part the text the compared string must hold
 * @returns the matcher
 */

export function textContaining(part: string): string {
    return expect.stringContaining(part) as string;
}
