// The hook manager and hook status of a sandbox, driven from its session the way the install command drives them.
import { join } from 'node:path';
import { expect } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { openSession } from '#cli/execution/session.ts';
import { hookStatus } from '#cli/lifecycle/hooks/status.ts';
import { uninstallCommand } from '#cli/commands/uninstall.ts';
import { installHookManager } from '#cli/lifecycle/hooks/managers.ts';

// The hook status of the sandbox, read from a fresh session.
async function hookStatusOf(root: string): Promise<ReturnType<typeof hookStatus>> {
    const session = await openSession(root);
    return hookStatus({ policy: session.policyFiles.policy, repository: session.repository });
}

/**
 * The line that says whether the sandbox's hooks are installed as recorded.
 * @param root the sandbox
 * @returns the status text
 */
export async function hookStatusText(root: string): Promise<string> {
    const status = await hookStatusOf(root);
    return status.text;
}

/**
 * Whether the sandbox's hooks are installed as recorded.
 * @param root the sandbox
 * @returns true when every hook is as installed
 */
export async function hookReadiness(root: string): Promise<boolean> {
    const status = await hookStatusOf(root);
    return status.ready;
}

/**
 * Installs the native hook manager the sandbox's policy names.
 * @param root the sandbox
 * @returns the line that says what was installed
 */
export async function installManager(root: string): Promise<string> {
    const session = await openSession(root);
    return installHookManager({ policy: session.policyFiles.policy, repository: session.repository, tools: session });
}

/**
 * Checks that the pre-commit dispatcher is installed and recorded, then uninstalls and checks that it is gone.
 * @param root the sandbox
 * @param hooks the directory Git resolves hooks from
 */
export async function expectUninstallRemovesHooks(root: string, hooks: string): Promise<void> {
    expect(readFileSync(join(hooks, 'pre-commit'), 'utf8')).toContain('check --staged');
    expect(await hookStatusText(root)).toContain(': installed');
    const result = await uninstallCommand({ cwd: root, yes: true, isDryRun: false });
    expect(result.exitCode).toBe(0);
    expect(existsSync(join(hooks, 'pre-commit'))).toBe(false);
}
