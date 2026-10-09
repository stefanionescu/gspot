import { afterEach, beforeEach } from 'bun:test';
import { openTestBudget } from '#tests/harness/command.ts';
import workspacePackage from '#workspace-package' with { type: 'json' };

const version = workspacePackage.packageManager.slice('bun@'.length);
if (Bun.version !== version)
    throw new Error(`Tests require Bun ${version}; found ${Bun.version}. Run mise run test from the repository root.`);

// Tests start outside hook context; hook scenarios set their own context explicitly.

let budget: Disposable | undefined;
beforeEach(() => {
    budget = openTestBudget();
});
afterEach(() => {
    budget?.[Symbol.dispose]();
});
