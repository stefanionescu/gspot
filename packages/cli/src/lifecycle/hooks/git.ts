import { isDeepStrictEqual } from 'node:util';
import { binaryPath } from '#cli/platform/assets.ts';
import { runBlocking } from '#cli/platform/spawn.ts';
import type { HookName } from '#cli/types/generation.ts';
import type { Policy } from '#cli/types/policy/policy.ts';
import { HOOK_ARTIFACTS } from '#cli/repository/hooks.ts';
import type { FileSnapshot } from '#cli/types/platform.ts';
import { basename, posix, relative, resolve } from 'node:path';
import { hookBody, hookCommand } from '#cli/generation/hooks.ts';
import { gitignoreBlock } from '#cli/configurations/manifests.ts';
import { EXECUTABLE_FILE, EXECUTE_BITS } from '#cli/constants/platform.ts';
import { hookLocation, relativeInside } from '#cli/repository/hook-location.ts';
import { readOwnership, withLifecycleOwner } from '#cli/lifecycle/ownership/owner.ts';
import type { HookLocation, Repository } from '#cli/types/repository/repository.ts';
import type { FileProposal, LifecycleOwner } from '#cli/types/lifecycle/lifecycle.ts';
import { HOOK_FILES, NATIVE_HOOK_MARKERS } from '#cli/constants/repository/repository.ts';
import type { PreparedHook, Installation, Restorations } from '#cli/types/lifecycle/hooks.ts';

function rejectDifferingNativeHook(
    path: string,
    current: FileSnapshot | undefined,
    generated: string | undefined,
    marker: string | undefined,
): void {
    const text = current?.bytes.toString('utf8');
    if (
        text !== undefined &&
        text !== generated &&
        marker !== undefined &&
        text.split('\n').some((line) => line.trimStart().startsWith(marker))
    )
        throw new Error(
            `Retained differing native hook ${path}. Preserve authored changes in the hook manager configuration, regenerate its native hooks, then run gspot install. No hooks were changed.`,
        );
}

// Refuses a hook that Git tracks, which the repository owns and gspot may not replace.
function assertUntracked(location: HookLocation, path: string, advice: string): void {
    const tracked = relativeInside(location.gitRoot, resolve(location.root, path));
    if (tracked === undefined) return;
    const result = runBlocking(['git', 'ls-files', '--error-unmatch', '--', tracked], { cwd: location.gitRoot });
    if (result.code === 0) throw new Error(`Retained tracked hook ${tracked}. ${advice}`);
}

// Refuses an original sibling the journal does not agree about.
function assertSiblingRecorded(
    recorded: Set<string>,
    location: HookLocation,
    sibling: string,
    original: FileSnapshot | undefined,
): void {
    if (recorded.has(sibling) && original === undefined)
        throw new Error(`Original hook sibling is missing: ${sibling}. Restore it from recovery before reinstalling.`);
    if (original !== undefined && !recorded.has(sibling))
        throw new Error(
            `Hook sibling already exists: ${location.absolute}/${basename(sibling)}. No hooks were changed.`,
        );
}

// Refuses a stage hook that Git tracks or that an interrupted installation left inconsistent.
function assertStageConsistent(
    installation: Installation,
    path: string,
    current: FileSnapshot | undefined,
    original: FileSnapshot | undefined,
): void {
    const { recorded, location } = installation;
    if (recorded.has(path)) return;
    if (current !== undefined)
        assertUntracked(location, path, 'Add the gspot invocation through its hook manager before installing.');
    if (original !== undefined && !isDeepStrictEqual(current, original))
        throw new Error(
            `Interrupted hook installation conflicts with ${path}; retain the original sibling and recovery data.`,
        );
}

// Whether the installed hook must run a predecessor: an authored hook that differs from the manager's own.
function isChained(
    installation: Installation,
    name: string,
    path: string,
    current: FileSnapshot | undefined,
    original: FileSnapshot | undefined,
): boolean {
    const predecessor = original ?? (installation.recorded.has(path) ? undefined : current);
    const generated = installation.manager?.get(name)?.generated;
    rejectDifferingNativeHook(path, predecessor, generated, installation.nativeMarker);
    return predecessor !== undefined && predecessor.bytes.toString('utf8') !== generated;
}

// The proposal that keeps an authored hook as the original sibling, when a chained hook has none yet.
function siblingProposals(
    installation: Installation,
    path: string,
    current: FileSnapshot | undefined,
    original: FileSnapshot | undefined,
    chain: boolean,
): FileProposal[] {
    if (!chain || original !== undefined || current === undefined) return [];
    if (process.platform !== 'win32' && (current.mode & EXECUTE_BITS) === 0)
        throw new Error(`Existing hook is not executable: ${path}. Retained without changing its behavior.`);
    return [installation.owner.proposeReplacement(`${path}.gspot-original`, current, 'hook')];
}

// The proposal for the manager's copy of a hook: installed with a manager, restored without one.
function managerCopyProposals(installation: Installation, name: string, path: string): FileProposal[] {
    const { owner, manager, recorded } = installation;
    const managerPath = `${path}.gspot-manager`;
    if (manager === undefined) return recorded.has(managerPath) ? [owner.proposeRestoration(managerPath)] : [];
    const content = manager.get(name);
    if (content === undefined) throw new Error(`The hook manager did not generate ${name}.`);
    const next = { bytes: Buffer.from(content.installed), mode: EXECUTABLE_FILE };
    return [owner.proposeReplacement(managerPath, next, 'hook')];
}

// The commands a stage hook runs: gspot itself, or the manager's copy and, for pre-commit's other stages, gspot too.
function hookCommands(installation: Installation, name: HookName): string[] {
    const { policy, manager, directory } = installation;
    const own = hookCommand(name, policy.runner?.tool, binaryPath(), directory);
    if (manager === undefined) return [own];
    const isPreCommit = policy.hooks?.tool === 'pre-commit';
    const managed = isPreCommit
        ? 'SKIP= PRE_COMMIT_ALLOW_NO_CONFIG= bash "$0.gspot-manager" "$@"'
        : 'SKIP_SIMPLE_GIT_HOOKS=0 bash "$0.gspot-manager" "$@"';
    return isPreCommit && name !== 'pre-commit' ? [managed, own] : [managed];
}

// The proposals for one of gspot's stage hooks: its original sibling, the manager's copy, and the hook itself.
function stageProposals(installation: Installation, name: HookName): FileProposal[] {
    const { owner, location, policy, recorded } = installation;
    const path = posix.join(location.directory, name);
    const current = owner.read(path);
    const original = owner.read(`${path}.gspot-original`);
    assertSiblingRecorded(recorded, location, `${path}.gspot-original`, original);
    assertStageConsistent(installation, path, current, original);
    const chain = isChained(installation, name, path, current, original);
    const body = hookBody(name, policy.runner?.tool, binaryPath(), chain, hookCommands(installation, name));
    const next = { bytes: Buffer.from(body), mode: EXECUTABLE_FILE };
    return [
        ...siblingProposals(installation, path, current, original, chain),
        ...managerCopyProposals(installation, name, path),
        owner.proposeReplacement(path, next, 'hook', current !== undefined && !recorded.has(path), current),
    ];
}

// The .gitignore block, proposed when the hooks live inside the checkout and outside .git.
function gitignoreProposals(installation: Installation): FileProposal[] {
    const { owner, location } = installation;
    const boundary = relativeInside(location.gitRoot, location.root);
    if (boundary === undefined || boundary === '.git' || boundary.startsWith('.git/')) return [];
    return [owner.proposeBlock('.gitignore', gitignoreBlock(), 'hash')];
}

// Restorations of recorded hooks outside the stages that the manager no longer generates.
function retiredProposals(installation: Installation): FileProposal[] {
    const { owner, location, manager } = installation;
    const entries = readOwnership(location.root, location.stateDirectory).files.filter(
        (entry) => entry.kind === 'hook',
    );
    return entries.flatMap((entry) => {
        const name = basename(entry.path);
        if (HOOK_ARTIFACTS.includes(name) || manager?.has(name) === true) return [];
        return [owner.proposeRestoration(entry.path)];
    });
}

// The proposal for a manager hook outside the stages, or undefined when an authored hook is kept.
function extraHookProposal(installation: Installation, name: string, content: PreparedHook): FileProposal | undefined {
    const { owner, location, recorded } = installation;
    if ((HOOK_FILES as readonly string[]).includes(name)) return undefined;
    const path = posix.join(location.directory, name);
    const current = owner.read(path);
    const next = { bytes: Buffer.from(content.installed), mode: EXECUTABLE_FILE };
    if (recorded.has(path)) return owner.proposeReplacement(path, next, 'hook', false, current);
    if (current === undefined) return undefined;
    // Preserve authored hooks outside the three gspot stages.
    if (current.bytes.toString('utf8') !== content.generated) {
        rejectDifferingNativeHook(path, current, content.generated, installation.nativeMarker);
        return undefined;
    }
    assertUntracked(location, path, 'No hooks were changed.');
    return owner.proposeReplacement(path, next, 'hook', true, current);
}

// The proposals for every hook the manager generates outside the stages.
function extraHookProposals(installation: Installation): FileProposal[] {
    return [...(installation.manager ?? [])].flatMap(([name, content]) => {
        const proposal = extraHookProposal(installation, name, content);
        return proposal === undefined ? [] : [proposal];
    });
}

// The restorations of one stage hook, its sibling, and its manager copy, and the edited files that are kept.
function stageRestorations(
    owner: LifecycleOwner,
    location: HookLocation,
    paths: Set<string>,
    name: string,
): Restorations {
    const path = posix.join(location.directory, name);
    const sibling = `${path}.gspot-original`;
    const original = paths.has(sibling) ? owner.read(sibling) : undefined;
    if (!paths.has(path)) {
        if (original === undefined) return { proposals: [], preserved: [] };
        if (isDeepStrictEqual(owner.read(path), original))
            return { proposals: [owner.proposeRestoration(sibling)], preserved: [] };
        return { proposals: [], preserved: [resolve(location.root, sibling)] };
    }
    const restoration = owner.proposeRestoration(path, original);
    if (restoration.status === 'preserved') return { proposals: [], preserved: [resolve(location.root, path)] };
    const companions = [sibling, `${path}.gspot-manager`].filter((companion) => paths.has(companion));
    return {
        proposals: [restoration, ...companions.map((companion) => owner.proposeRestoration(companion))],
        preserved: [],
    };
}

/**
 * Plan the dispatcher and original sibling before applying any hook mutation.
 * @param options the policy and the repository the hooks belong to
 * @param options.policy the repository policy
 * @param options.repository the repository root and whether Git is present
 * @param manager the hooks a native manager prepared, when one owns the hooks
 * @returns the line that says what was installed, or '' when nothing was
 */
export function installHooks(
    { policy, repository }: { policy: Policy; repository: Pick<Repository, 'root' | 'hasGit'> },
    manager?: ReadonlyMap<string, PreparedHook>,
): string {
    if (!repository.hasGit || (policy.hooks?.tool !== 'gspot' && manager === undefined)) return '';
    const location = hookLocation(repository.root);
    return withLifecycleOwner(
        location.root,
        (owner) => {
            const installation: Installation = {
                owner,
                location,
                policy,
                manager,
                recorded: new Set(owner.paths()),
                nativeMarker: manager === undefined ? undefined : NATIVE_HOOK_MARKERS[policy.hooks?.tool ?? ''],
                directory: relative(location.gitRoot, repository.root).replaceAll('\\', '/'),
            };
            const proposals = [
                ...gitignoreProposals(installation),
                ...HOOK_FILES.flatMap((name) => stageProposals(installation, name)),
                ...retiredProposals(installation),
                ...extraHookProposals(installation),
            ];
            const conflict = proposals.find((proposal) => proposal.status === 'preserved');
            if (conflict !== undefined)
                throw new Error(`Retained edited hook ${conflict.path}. Review it before running gspot install.`);
            owner.applyProposals(proposals);
            return `installed hooks in ${location.absolute}`;
        },
        location.stateDirectory,
    );
}

/**
 * Plan hook restoration while both the repository and Git hook boundaries remain locked.
 * @param owner the lifecycle owner of the hooks directory
 * @param location the hooks directory with its roots
 * @returns the restorations to apply and the edited hooks that are kept
 */
export function proposeHookRestorations(owner: LifecycleOwner, location: HookLocation): Restorations {
    const entries = readOwnership(location.root, location.stateDirectory).files.filter(
        (entry) => entry.kind === 'hook',
    );
    const paths = new Set(entries.map((entry) => entry.path));
    const stages = HOOK_FILES.map((name) => stageRestorations(owner, location, paths, name));
    const extras = entries.flatMap((entry) =>
        HOOK_ARTIFACTS.includes(basename(entry.path)) ? [] : [owner.proposeRestoration(entry.path)],
    );
    const proposals = [...stages.flatMap((stage) => stage.proposals), ...extras];
    const preserved = [
        ...stages.flatMap((stage) => stage.preserved),
        ...proposals
            .filter((proposal) => proposal.status === 'preserved')
            .map((proposal) => resolve(location.root, proposal.path)),
    ];
    return { proposals: proposals.filter((proposal) => proposal.status !== 'preserved'), preserved };
}
