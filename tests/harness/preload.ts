import { openTestBudget } from '#tests/harness/command.ts';
import { TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { afterEach, beforeEach, setDefaultTimeout } from 'bun:test';
import { setEnvironmentVariable } from '#tests/harness/environment.ts';
import workspacePackage from '#workspace-package' with { type: 'json' };

if (Bun.version !== workspacePackage.engines.bun)
    throw new Error(
        `Tests require Bun ${workspacePackage.engines.bun}; found ${Bun.version}. Run mise run test from the repository root.`,
    );

// Tests start outside hook context; hook scenarios set their own context explicitly.
setEnvironmentVariable('GSPOT_HOOK', undefined);

setDefaultTimeout(TEST_TIMEOUT_MS);

let budget: Disposable | undefined;
beforeEach(() => {
    budget = openTestBudget();
});
afterEach(() => {
    budget?.[Symbol.dispose]();
});
