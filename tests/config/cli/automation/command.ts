// Child output must remain visible when a later step consumes the test's remaining time.
import { TEST_TIMEOUT_MS, NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';

/** Bun reports the selected test file in argv regardless of flags or folder selection. */
export const BUDGET_COMMAND = `import { test } from 'bun:test';
import { suiteTimeout } from COMMAND_OWNER;
test('report the selected test budget', () => {
    console.log(JSON.stringify({ argv: Bun.argv, timeout: suiteTimeout() }));
});
`;

/** The four suite boundaries own their budgets independently of the parent command's timeout. */
export const SUITE_BUDGET_CASES = [
    { suite: 'cli', timeout: TEST_TIMEOUT_MS },
    { suite: 'plugin', timeout: TEST_TIMEOUT_MS },
    { suite: 'tools', timeout: NATIVE_TEST_TIMEOUT_MS },
    { suite: 'packages', timeout: NATIVE_TEST_TIMEOUT_MS },
];

export const WAITING_COMMAND = String.raw`process.stdout.write('step stdout\n'); process.stderr.write('step stderr\n'); await Bun.sleep(10000);`;

export const FIRST_COMMAND = String.raw`process.stdout.write('first step\n'); await Bun.sleep(1000);`;

export const STEP_TIMEOUT_MS = 1000;

export const SCENARIO_TIMEOUT_MS = 5000;
