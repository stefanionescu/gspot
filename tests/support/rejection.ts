// The error a promise rejects with. Bun runs the expect(...).rejects matchers asynchronously while its types
// declare them void, so a test awaits the rejection here and asserts on the error it gets back.

/**
 * Awaits a promise that must reject with an error.
 * @param promise the promise expected to reject
 * @returns the error it rejected with
 */
export async function rejection(promise: Promise<unknown>): Promise<Error> {
    let settled: { rejected: true; error: unknown } | { rejected: false } = { rejected: false };
    try {
        await promise;
    } catch (error) {
        settled = { rejected: true, error };
    }
    if (!settled.rejected) throw new Error('The promise resolved, and a rejection was expected.');
    if (!(settled.error instanceof Error))
        throw new Error(`The promise rejected with a value that is not an error: ${String(settled.error)}`);
    return settled.error;
}
