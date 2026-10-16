// Bun registers tests; the preload opens and disposes their shared child-process timeout.
import { startTestTimeout } from '#tests/setup/processes.ts';
import { afterEach, beforeEach, setDefaultTimeout } from 'bun:test';
import { TEST_TIMEOUT_MILLISECONDS } from '#tests/data/test-setup.ts';

setDefaultTimeout(TEST_TIMEOUT_MILLISECONDS);

let testTimeout: Disposable | undefined;

beforeEach(() => {
    testTimeout = startTestTimeout();
});

afterEach(() => {
    testTimeout?.[Symbol.dispose]();
});
