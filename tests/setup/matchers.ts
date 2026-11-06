import { expect } from 'bun:test';

export async function captureRejection(promise: Promise<unknown>): Promise<Error> {
    try {
        await promise;
    } catch (error) {
        if (error instanceof Error) return error;
        throw new Error(`The promise rejected with a value that is not an error: ${String(error)}`, { cause: error });
    }
    throw new Error('The promise resolved, and a rejection was expected.');
}

export function matchFields<T>(shape: NoInfer<Partial<T>>): T {
    return expect.objectContaining(shape) as T;
}
