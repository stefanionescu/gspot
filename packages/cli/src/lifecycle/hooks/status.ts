// Whether the installed Git hooks still match what the journal recorded, with the line that says so.
import { basename, posix } from 'node:path';
import { binaryPath } from '#cli/platform/assets.ts';
import type { Policy } from '#cli/policy/normalize.ts';
import type { Repository } from '#cli/repository/tree.ts';
import { EXECUTE_BITS } from '#cli/platform/file-modes.ts';
import { readOwnership } from '#cli/lifecycle/ownership.ts';
import type { OwnershipEntry } from '#cli/lifecycle/journal.ts';
import { HOOK_ARTIFACTS, HOOK_FILES } from '#cli/repository/hooks.ts';
import { preCommitConfiguration } from '#cli/generation/pre-commit.ts';
import { hasConfiguration } from '#cli/lifecycle/configuration-document.ts';
import { simpleGitHookFallback } from '#cli/generation/simple-git-hooks.ts';
import { huskyReady, simpleGitHooksReady } from '#cli/lifecycle/hooks/state.ts';
import { type HookLocation, hookLocation } from '#cli/lifecycle/hooks/location.ts';
import { type HookName, huskyLines, lefthookConfiguration } from '#cli/generation/hooks.ts';
import { type ConfinedRoot, type FileSnapshot, openConfinedRoot } from '#cli/platform/filesystem.ts';

type Readiness = (root: string, runner: string | undefined, binary: string | undefined) => boolean;
type Status = {
    policy: Policy;
    root: string;
    location: HookLocation;
    entries: OwnershipEntry[];
    hasManager: boolean;
    husky: Map<string, string> | undefined;
};

// Whether each native manager's integration is in place, by the tool that owns the hooks.
const INTEGRATIONS: Record<string, Readiness> = {
    'pre-commit': (root, runner, binary) => hasConfiguration(root, preCommitConfiguration(root, runner, binary)),
    'simple-git-hooks': simpleGitHooksReady,
    lefthook: (root, runner, binary) => hasConfiguration(root, lefthookConfiguration(root, runner, binary)),
    husky: huskyReady,
};

// The text that says why a native manager's integration is not ready, or undefined when it is.
function integrationStatus(policy: Policy, root: string): string | undefined {
    const tool = policy.hooks?.tool ?? 'gspot';
    if (tool === 'gspot') return undefined;
    const isReady = INTEGRATIONS[tool];
    if (isReady === undefined) return `${tool}: run gspot install to verify integration`;
    return isReady(root, policy.runner?.tool, binaryPath())
        ? undefined
        : `${tool} integration is missing or edited; run gspot apply`;
}

// Whether a file is the one the journal installed, by mode and content.
function isInstalled(current: FileSnapshot | undefined, installed: OwnershipEntry['installed']): boolean {
    if (current?.mode !== installed?.mode || current === undefined) return false;
    return new Bun.CryptoHasher('sha256').update(current.bytes).digest('hex') === installed?.hash;
}

// The command a manager copy must carry for this hook, when the manager's integration names one.
function expectedCommand(status: Status, name: HookName): string | undefined {
    const fromHusky = status.husky?.get(name);
    if (fromHusky !== undefined) return fromHusky;
    if (status.policy.hooks?.tool !== 'simple-git-hooks') return undefined;
    const fallback = simpleGitHookFallback(status.root, name, status.policy.runner?.tool, binaryPath());
    return fallback.replaceAll("'", "'\"'\"'");
}

// The text that says an original sibling is missing or not executable, or undefined when it is sound or absent.
function siblingStatus(status: Status, files: ConfinedRoot, name: string, sibling: string): string | undefined {
    if (!status.entries.some((entry) => entry.path === sibling)) return undefined;
    const original = files.read(sibling);
    const isExecutable =
        process.platform === 'win32' || (original !== undefined && (original.mode & EXECUTE_BITS) !== 0);
    if (original !== undefined && isExecutable) return undefined;
    return `${status.location.absolute}: original ${name} is missing or not executable; restore it from recovery and run gspot install`;
}

// The text that says a required hook file is missing or edited, or undefined when it is installed.
function requiredStatus(status: Status, files: ConfinedRoot, name: HookName, required: string): string | undefined {
    const current = files.read(required);
    const installed = status.entries.find((entry) => entry.path === required)?.installed;
    const command = expectedCommand(status, name);
    const isManagerCopy = required.endsWith('.gspot-manager');
    const lacksCommand =
        command !== undefined && isManagerCopy && current?.bytes.toString('utf8').includes(command) !== true;
    if (isInstalled(current, installed) && !lacksCommand) return undefined;
    return `${status.location.absolute}: missing or edited ${basename(required)}; run gspot install`;
}

// The text that says one of gspot's stage hooks is not as installed, or undefined when all its files are.
function stageStatus(status: Status, files: ConfinedRoot, name: HookName): string | undefined {
    const path = posix.join(status.location.directory, name);
    const sibling = siblingStatus(status, files, name, `${path}.gspot-original`);
    if (sibling !== undefined) return sibling;
    const required = status.hasManager ? [path, `${path}.gspot-manager`] : [path];
    return required.map((file) => requiredStatus(status, files, name, file)).find((text) => text !== undefined);
}

// The text that says a hook outside the stages is not as installed, or undefined when every one is.
function extraStatus(status: Status, files: ConfinedRoot): string | undefined {
    for (const entry of status.entries.filter((entry) => entry.kind === 'hook')) {
        const name = basename(entry.path);
        if (HOOK_ARTIFACTS.includes(name)) continue;
        if (!isInstalled(files.read(entry.path), entry.installed))
            return `${status.location.absolute}: missing or edited ${name}; run gspot install`;
    }
    return undefined;
}

/**
 * Compare Git's executable hook files with their recorded installed identities.
 * @param options the policy and the repository the hooks belong to
 * @param options.policy the repository policy
 * @param options.repository the repository root and whether Git is present
 * @returns whether the hooks are ready, with the line that says so
 */
export function hookStatus({
    policy,
    repository,
}: {
    policy: Policy;
    repository: Pick<Repository, 'root' | 'hasGit'>;
}): { ready: boolean; text: string } {
    if (policy.hooks === undefined) return { ready: true, text: 'none' };
    if (!repository.hasGit) return { ready: false, text: 'not installed: no Git repository' };
    const integration = integrationStatus(policy, repository.root);
    if (integration !== undefined) return { ready: false, text: integration };
    const location = hookLocation(repository.root);
    const husky =
        policy.hooks.tool === 'husky'
            ? new Map(
                  huskyLines(repository.root, policy.runner?.tool, binaryPath()).map(({ path, line }) => [
                      basename(path),
                      line,
                  ]),
              )
            : undefined;
    const status: Status = {
        policy,
        root: repository.root,
        location,
        entries: readOwnership(location.root, location.stateDirectory).files,
        hasManager: policy.hooks.tool in INTEGRATIONS,
        husky,
    };
    const files = openConfinedRoot(location.root);
    try {
        const stages = HOOK_FILES.map((name) => stageStatus(status, files, name));
        const failure = stages.find((text) => text !== undefined) ?? extraStatus(status, files);
        return failure === undefined
            ? { ready: true, text: `${location.absolute}: installed` }
            : { ready: false, text: failure };
    } finally {
        files.close();
    }
}
