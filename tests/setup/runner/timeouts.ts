// Bun loads this file before every test file. It gives each test a timeout that also bounds its child processes.
import { startTestTimeout } from '#tests/setup/system/processes.ts';
import { afterEach, beforeEach, setDefaultTimeout } from 'bun:test';
import { TEST_TIMEOUT_MILLISECONDS } from '#tests/config/setup/environment.ts';

setDefaultTimeout(TEST_TIMEOUT_MILLISECONDS);

let testTimeout: Disposable | undefined;

beforeEach(() => {
    testTimeout = startTestTimeout();
});

afterEach(() => {
    testTimeout?.[Symbol.dispose]();
});
