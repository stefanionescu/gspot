// Reads error and rejection messages and builds typed partial assertions.
import { expect } from 'bun:test';

/**
 * Await a promise that must reject with an error.
 *
 * @param promise what must reject.
 * @returns the error it rejected with.
 */
export async function captureRejectedError(promise: Promise<unknown>): Promise<Error> {
    try {
        await promise;
    } catch (error) {
        if (error instanceof Error) return error;
        throw new Error(`The promise rejected with a value that is not an error: ${String(error)}`);
    }
    throw new Error('The promise resolved, and a rejection was expected.');
}

/**
 * Await a promise that must reject with an error.
 *
 * @param promise what must reject.
 * @returns the message of the error it rejected with.
 */
export async function captureRejection(promise: Promise<unknown>): Promise<string> {
    const error = await captureRejectedError(promise);
    return error.message;
}

/**
 * Run a function that must throw an error.
 *
 * @param run what must throw.
 * @returns the message of the error it threw.
 */
export function captureThrow(run: () => unknown): string {
    try {
        run();
    } catch (error) {
        if (error instanceof Error) return error.message;
        throw new Error(`The function threw a value that is not an error: ${String(error)}`);
    }
    throw new Error('The function returned, and an error was expected.');
}

/**
 * An object that must hold these properties, typed as the compared value.
 *
 * @param shape the properties the compared object must hold.
 * @returns the matcher.
 */
export function matchFields<T>(shape: NoInfer<Partial<T>>): T {
    return expect.objectContaining(shape) as T;
}

/**
 * An array that must hold these items, typed as the compared value.
 *
 * @param items what the compared array must hold.
 * @returns the matcher.
 */
export function matchItems<T>(items: NoInfer<T[]>): T[] {
    return expect.arrayContaining(items) as T[];
}
