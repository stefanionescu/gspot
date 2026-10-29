import { expect } from 'bun:test';

/**
Await a promise that must reject with an error.
*/
export async function captureRejection(promise: Promise<unknown>): Promise<Error> {
    try {
        await promise;
    } catch (error) {
        if (error instanceof Error) return error;
        throw new Error(`The promise rejected with a value that is not an error: ${String(error)}`);
    }
    throw new Error('The promise resolved, and a rejection was expected.');
}

/**
An object that must hold these properties, typed as the compared value.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The cast lets an asymmetric matcher stand where a test expects T.
export function matchFields<T>(shape: NoInfer<Partial<T>>): T {
    return expect.objectContaining(shape) as T;
}
