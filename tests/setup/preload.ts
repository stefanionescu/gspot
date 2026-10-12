// Bun registers tests; the preload opens and disposes their shared child-process timeout.
import { afterEach, beforeEach } from 'bun:test';
import { startTestTimeout } from '#tests/setup/processes.ts';

let testTimeout: Disposable | undefined;
beforeEach(() => {
    testTimeout = startTestTimeout();
});
afterEach(() => {
    testTimeout?.[Symbol.dispose]();
});
