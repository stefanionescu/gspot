import { HOOK_FILES } from '#cli/checks/integrity-definitions.ts';
import { NATIVE_HOOK_MARKERS } from '#cli/emit/hooks-definitions.ts';
import { hookBody, hookCommand, huskyLines, huskyReady, lefthookConfiguration } from '#cli/emit/hooks.ts';
import { gitignoreBlock } from '#cli/emit/managed-blocks.ts';
import { preCommitReady } from '#cli/emit/pre-commit.ts';
import { simpleGitHookFallback, simpleGitHooksReady } from '#cli/emit/simple-git-hooks.ts';
import { hasConfiguration } from '#cli/lifecycle/configuration-document.ts';
import { openConfinedRoot } from '#cli/lifecycle/confined.ts';
import { readOwnership, withLifecycleOwner } from '#cli/lifecycle/ownership.ts';
import type { FileProposal, FileSnapshot, HookLocation, LifecycleOwner, PreparedHook } from '#cli/lifecycle/types.ts';
import { binaryPath } from '#cli/platform/assets.ts';
import { runBlocking } from '#cli/platform/spawn.ts';
import type { Session } from '#cli/run/types.ts';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

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

/** Ask Git for the actual clone-local destination, including worktrees and core.hooksPath. */
export function hookLocation(root: string): HookLocation {
    const repository = runBlocking(['git', 'rev-parse', '--show-toplevel'], { cwd: root });
    if (repository.code !== 0) throw new Error(`Cannot resolve Git root: ${repository.stderr.trim()}`);
    const top = resolve(root, repository.stdout.replace(/\n$/u, ''));
    // An explicit path format canonicalizes symlinks before confinement can inspect them.
    const result = runBlocking(['git', 'rev-parse', '--git-path', 'hooks'], { cwd: top });
    if (result.code !== 0) throw new Error(`Cannot resolve Git hooks: ${result.stderr.trim()}`);
    const absolute = resolve(top, result.stdout.replace(/\n$/u, ''));
    const location = { root: dirname(absolute), directory: basename(absolute), absolute, gitRoot: top };
    const local = relative(top, absolute).replaceAll('\\', '/');
    const inside = local !== '..' && !local.startsWith('../') && !isAbsolute(local);
    const files = openConfinedRoot(inside ? top : location.root);
    try {
        const directory = inside && local === '' ? undefined : files.stat(inside ? local : location.directory);
        if (directory !== undefined && !directory.isDirectory())
            throw new Error(`Git hooks destination is not a directory: ${absolute}`);
    } finally {
        files.close();
    }
    return location;
}

/** Plan the dispatcher and original sibling before applying any hook mutation. */
export function installHooks(session: Session, manager?: ReadonlyMap<string, PreparedHook>): string {
    if (!session.repository.hasGit || (session.policyFiles.policy.hooks?.tool !== 'gspot' && manager === undefined))
        return '';
    const nativeMarker =
        manager === undefined ? undefined : NATIVE_HOOK_MARKERS[session.policyFiles.policy.hooks?.tool ?? ''];
    const location = hookLocation(session.root);
    const directory = relative(location.gitRoot, session.root).replaceAll('\\', '/');
    return withLifecycleOwner(location.root, (owner) => {
        const recorded = new Set(owner.paths());
        const proposals: FileProposal[] = [];
        const boundary = relative(location.gitRoot, location.root).replaceAll('\\', '/');
        if (
            boundary !== '..' &&
            !boundary.startsWith('../') &&
            !isAbsolute(boundary) &&
            boundary !== '.git' &&
            !boundary.startsWith('.git/')
        )
            proposals.push(owner.proposeBlock('.gitignore', gitignoreBlock(), 'hash'));
        for (const name of HOOK_FILES) {
            const path = `${location.directory}/${name}`;
            const sibling = `${path}.gspot-original`;
            const current = owner.read(path);
            const original = owner.read(sibling);
            if (recorded.has(sibling) && original === undefined)
                throw new Error(
                    `Original hook sibling is missing: ${sibling}. Restore it from recovery before reinstalling.`,
                );
            if (original !== undefined && !recorded.has(sibling))
                throw new Error(
                    `Hook sibling already exists: ${location.absolute}/${name}.gspot-original. No hooks were changed.`,
                );
            const tracked = relative(location.gitRoot, resolve(location.root, path));
            if (current !== undefined && !recorded.has(path) && !tracked.startsWith('../') && !isAbsolute(tracked)) {
                const result = runBlocking(['git', 'ls-files', '--error-unmatch', '--', tracked], {
                    cwd: location.gitRoot,
                });
                if (result.code === 0)
                    throw new Error(
                        `Retained tracked hook ${tracked}. Add the gspot invocation through its hook manager before installing.`,
                    );
            }
            if (!recorded.has(path) && original !== undefined && !isDeepStrictEqual(current, original))
                throw new Error(
                    `Interrupted hook installation conflicts with ${path}; retain the original sibling and recovery data.`,
                );
            const predecessor = original ?? (recorded.has(path) ? undefined : current);
            const chain =
                predecessor !== undefined && predecessor.bytes.toString('utf8') !== manager?.get(name)?.generated;
            rejectDifferingNativeHook(path, predecessor, manager?.get(name)?.generated, nativeMarker);
            if (chain && original === undefined && current !== undefined) {
                if (process.platform !== 'win32' && (current.mode & 0o111) === 0)
                    throw new Error(
                        `Existing hook is not executable: ${path}. Retained without changing its behavior.`,
                    );
                proposals.push(owner.proposeReplacement(sibling, current, 'hook'));
            }
            const managerPath = `${path}.gspot-manager`;
            if (manager !== undefined) {
                const content = manager.get(name);
                if (content === undefined) throw new Error(`The hook manager did not generate ${name}.`);
                proposals.push(
                    owner.proposeReplacement(
                        managerPath,
                        { bytes: Buffer.from(content.installed), mode: 0o755 },
                        'hook',
                    ),
                );
            } else if (recorded.has(managerPath)) proposals.push(owner.proposeRestoration(managerPath));
            const native = session.policyFiles.policy.hooks?.tool === 'pre-commit';
            const commands =
                manager === undefined
                    ? [hookCommand(name, session.policyFiles.policy.runner?.tool, binaryPath(), directory)]
                    : [
                          native
                              ? 'SKIP= PRE_COMMIT_ALLOW_NO_CONFIG= bash "$0.gspot-manager" "$@"'
                              : 'SKIP_SIMPLE_GIT_HOOKS=0 bash "$0.gspot-manager" "$@"',
                          ...(native && name !== 'pre-commit'
                              ? [hookCommand(name, session.policyFiles.policy.runner?.tool, binaryPath(), directory)]
                              : []),
                      ];
            proposals.push(
                owner.proposeReplacement(
                    path,
                    {
                        bytes: Buffer.from(
                            hookBody(name, session.policyFiles.policy.runner?.tool, binaryPath(), chain, commands),
                        ),
                        mode: 0o755,
                    },
                    'hook',
                    current !== undefined && !recorded.has(path),
                    current,
                ),
            );
        }
        for (const entry of readOwnership(location.root).files.filter((entry) => entry.kind === 'hook')) {
            const name = basename(entry.path);
            if (
                HOOK_FILES.some(
                    (hook) => name === hook || name === `${hook}.gspot-original` || name === `${hook}.gspot-manager`,
                )
            )
                continue;
            if (!manager?.has(name)) proposals.push(owner.proposeRestoration(entry.path));
        }
        for (const [name, content] of manager ?? []) {
            if (HOOK_FILES.some((hook) => hook === name)) continue;
            const path = `${location.directory}/${name}`;
            const current = owner.read(path);
            if (current === undefined && !recorded.has(path)) continue;
            // Preserve authored hooks outside the three gspot stages.
            if (!recorded.has(path) && current?.bytes.toString('utf8') !== content.generated) {
                rejectDifferingNativeHook(path, current, content.generated, nativeMarker);
                continue;
            }
            const tracked = relative(location.gitRoot, resolve(location.root, path));
            if (!recorded.has(path) && !tracked.startsWith('../') && !isAbsolute(tracked)) {
                const result = runBlocking(['git', 'ls-files', '--error-unmatch', '--', tracked], {
                    cwd: location.gitRoot,
                });
                if (result.code === 0) throw new Error(`Retained tracked hook ${tracked}. No hooks were changed.`);
            }
            proposals.push(
                owner.proposeReplacement(
                    path,
                    { bytes: Buffer.from(content.installed), mode: 0o755 },
                    'hook',
                    !recorded.has(path),
                    current,
                ),
            );
        }
        const conflict = proposals.find((proposal) => proposal.status === 'preserved');
        if (conflict !== undefined)
            throw new Error(`Retained edited hook ${conflict.path}. Review it before running gspot install.`);
        owner.applyProposals(proposals);
        return `installed hooks in ${location.absolute}`;
    });
}

/** Plan hook restoration while both the repository and Git hook boundaries remain locked. */
export function proposeHookRestorations(
    owner: LifecycleOwner,
    location: HookLocation,
): {
    proposals: FileProposal[];
    preserved: string[];
} {
    const entries = readOwnership(location.root).files.filter((entry) => entry.kind === 'hook');
    const preserved: string[] = [];
    const proposals: FileProposal[] = [];
    for (const name of HOOK_FILES) {
        const path = `${location.directory}/${name}`;
        const sibling = `${path}.gspot-original`;
        const original = entries.some((entry) => entry.path === sibling) ? owner.read(sibling) : undefined;
        if (!entries.some((entry) => entry.path === path)) {
            if (original !== undefined && isDeepStrictEqual(owner.read(path), original)) {
                proposals.push(owner.proposeRestoration(sibling));
            } else if (original !== undefined) preserved.push(resolve(location.root, sibling));
            continue;
        }
        const restoration = owner.proposeRestoration(path, original);
        if (restoration.status === 'preserved') {
            preserved.push(resolve(location.root, path));
            continue;
        }
        proposals.push(restoration);
        if (entries.some((entry) => entry.path === sibling)) proposals.push(owner.proposeRestoration(sibling));
        const manager = `${path}.gspot-manager`;
        if (entries.some((entry) => entry.path === manager)) proposals.push(owner.proposeRestoration(manager));
    }
    for (const entry of entries) {
        const name = basename(entry.path);
        if (
            HOOK_FILES.some(
                (hook) => name === hook || name === `${hook}.gspot-original` || name === `${hook}.gspot-manager`,
            )
        )
            continue;
        proposals.push(owner.proposeRestoration(entry.path));
    }
    preserved.push(
        ...proposals
            .filter((proposal) => proposal.status === 'preserved')
            .map((proposal) => resolve(location.root, proposal.path)),
    );
    return { proposals: proposals.filter((proposal) => proposal.status !== 'preserved'), preserved };
}

/** Compare Git's executable hook files with their recorded installed identities. */
export function hookStatus(
    session: Pick<Session, 'root' | 'policyFiles'> & { repository: Pick<Session['repository'], 'hasGit'> },
): { ready: boolean; text: string } {
    if (session.policyFiles.policy.hooks === undefined) return { ready: true, text: 'none' };
    if (!session.repository.hasGit) return { ready: false, text: 'not installed: no Git repository' };
    const manager = ['simple-git-hooks', 'pre-commit', 'lefthook', 'husky'].includes(
        session.policyFiles.policy.hooks.tool,
    );
    if (
        session.policyFiles.policy.hooks.tool === 'pre-commit' &&
        !preCommitReady(session.root, session.policyFiles.policy.runner?.tool, binaryPath())
    )
        return { ready: false, text: 'pre-commit integration is missing or edited; run gspot apply' };
    if (
        session.policyFiles.policy.hooks.tool === 'simple-git-hooks' &&
        !simpleGitHooksReady(session.root, session.policyFiles.policy.runner?.tool, binaryPath())
    )
        return { ready: false, text: 'simple-git-hooks integration is missing or edited; run gspot apply' };
    if (
        session.policyFiles.policy.hooks.tool === 'lefthook' &&
        !hasConfiguration(
            session.root,
            lefthookConfiguration(session.root, session.policyFiles.policy.runner?.tool, binaryPath()),
        )
    )
        return { ready: false, text: 'lefthook integration is missing or edited; run gspot apply' };
    if (session.policyFiles.policy.hooks.tool !== 'gspot' && !manager)
        return {
            ready: false,
            text: `${session.policyFiles.policy.hooks.tool}: run gspot install to verify integration`,
        };
    if (
        session.policyFiles.policy.hooks.tool === 'husky' &&
        !huskyReady(session.root, session.policyFiles.policy.runner?.tool, binaryPath())
    )
        return { ready: false, text: 'husky integration is missing or edited; run gspot apply' };
    const location = hookLocation(session.root);
    const entries = readOwnership(location.root).files;
    const husky =
        session.policyFiles.policy.hooks.tool === 'husky'
            ? new Map(
                  huskyLines(session.root, session.policyFiles.policy.runner?.tool, binaryPath()).map(
                      ({ path, line }) => [basename(path), line],
                  ),
              )
            : undefined;
    const files = openConfinedRoot(location.root);
    try {
        for (const name of HOOK_FILES) {
            const path = `${location.directory}/${name}`;
            const sibling = `${path}.gspot-original`;
            if (entries.some((entry) => entry.path === sibling)) {
                const original = files.read(sibling);
                if (original === undefined || (process.platform !== 'win32' && (original.mode & 0o111) === 0))
                    return {
                        ready: false,
                        text: `${location.absolute}: original ${name} is missing or not executable; restore it from recovery and run gspot install`,
                    };
            }
            for (const required of manager ? [path, `${path}.gspot-manager`] : [path]) {
                const current = files.read(required);
                const installed = entries.find((entry) => entry.path === required)?.installed;
                const command =
                    husky?.get(name) ??
                    (session.policyFiles.policy.hooks.tool === 'simple-git-hooks'
                        ? simpleGitHookFallback(
                              session.root,
                              name,
                              session.policyFiles.policy.runner?.tool,
                              binaryPath(),
                          ).replaceAll("'", "'\"'\"'")
                        : undefined);
                if (
                    current === undefined ||
                    installed === undefined ||
                    current.mode !== installed.mode ||
                    (command !== undefined &&
                        required === `${path}.gspot-manager` &&
                        !current.bytes.toString('utf8').includes(command)) ||
                    new Bun.CryptoHasher('sha256').update(current.bytes).digest('hex') !== installed.hash
                )
                    return {
                        ready: false,
                        text: `${location.absolute}: missing or edited ${basename(required)}; run gspot install`,
                    };
            }
        }
        for (const entry of entries.filter((entry) => entry.kind === 'hook')) {
            const name = basename(entry.path);
            if (
                HOOK_FILES.some(
                    (hook) => name === hook || name === `${hook}.gspot-original` || name === `${hook}.gspot-manager`,
                )
            )
                continue;
            const current = files.read(entry.path);
            if (
                current === undefined ||
                entry.installed === undefined ||
                current.mode !== entry.installed.mode ||
                new Bun.CryptoHasher('sha256').update(current.bytes).digest('hex') !== entry.installed.hash
            )
                return { ready: false, text: `${location.absolute}: missing or edited ${name}; run gspot install` };
        }
        return { ready: true, text: `${location.absolute}: installed` };
    } finally {
        files.close();
    }
}
