import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { runBlocking } from '#cli/platform/spawn.ts';
import { binaryPath } from '#cli/platform/assets.ts';
import { hookBody } from '#cli/emit/hooks.ts';
import { HOOK_FILES } from '#cli/checks/integrity-definitions.ts';
import { withLifecycleOwner, readOwnership } from '#cli/lifecycle/ownership.ts';
import { openConfinedRoot } from '#cli/lifecycle/confined.ts';
import type { Session } from '#cli/run/types.ts';
import type { HookLocation, FileProposal } from '#cli/lifecycle/types.ts';

/** Ask Git for the actual clone-local destination, including worktrees and core.hooksPath. */
export function hookLocation(root: string): HookLocation {
    const result = runBlocking(['git', 'rev-parse', '--path-format=absolute', '--git-path', 'hooks'], { cwd: root });
    if (result.code !== 0) throw new Error(`Cannot resolve Git hooks: ${result.stderr.trim()}`);
    const absolute = resolve(root, result.stdout.replace(/\n$/u, ''));
    return { root: dirname(absolute), directory: basename(absolute), absolute };
}

/** Plan the dispatcher and original sibling before applying any hook mutation. */
export function installHooks(session: Session): string {
    if (!session.repository.hasGit || session.policyFiles.policy.hooks?.tool !== 'gspot') return '';
    const location = hookLocation(session.root);
    return withLifecycleOwner(location.root, (owner) => {
        const recorded = new Set(owner.paths());
        const proposals: FileProposal[] = [];
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
            const tracked = relative(session.root, resolve(location.root, path));
            if (current !== undefined && !recorded.has(path) && !tracked.startsWith('../') && !isAbsolute(tracked)) {
                const result = runBlocking(['git', 'ls-files', '--error-unmatch', '--', tracked], {
                    cwd: session.root,
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
            const chain = original !== undefined || (current !== undefined && !recorded.has(path));
            if (chain && original === undefined && current !== undefined) {
                if ((current.mode & 0o111) === 0)
                    throw new Error(
                        `Existing hook is not executable: ${path}. Retained without changing its behavior.`,
                    );
                proposals.push(owner.proposeReplacement(sibling, current, 'hook'));
            }
            proposals.push(
                owner.proposeReplacement(
                    path,
                    {
                        bytes: Buffer.from(
                            hookBody(name, session.policyFiles.policy.runner?.tool, binaryPath(), chain),
                        ),
                        mode: 0o755,
                    },
                    'hook',
                    current !== undefined && !recorded.has(path),
                    current,
                ),
            );
        }
        const conflict = proposals.find((proposal) => proposal.status === 'preserved');
        if (conflict !== undefined)
            throw new Error(`Retained edited hook ${conflict.path}. Review it before running gspot install.`);
        for (const proposal of proposals) owner.applyProposal(proposal);
        return `installed hooks in ${location.absolute}`;
    });
}

/** Restore unchanged dispatchers while retaining subsequent edits to their original executables. */
export function uninstallHooks(session: Session): string[] {
    if (!session.repository.hasGit) return [];
    const location = hookLocation(session.root);
    const before = readOwnership(location.root);
    if (before.pending === undefined && !before.files.some((entry) => entry.kind === 'hook')) return [];
    return withLifecycleOwner(location.root, (owner) => {
        const entries = readOwnership(location.root).files.filter((entry) => entry.kind === 'hook');
        const preserved: string[] = [];
        for (const name of HOOK_FILES) {
            const path = `${location.directory}/${name}`;
            const sibling = `${path}.gspot-original`;
            const original = entries.some((entry) => entry.path === sibling) ? owner.read(sibling) : undefined;
            if (!entries.some((entry) => entry.path === path)) {
                if (original !== undefined && isDeepStrictEqual(owner.read(path), original)) {
                    if (owner.restore(sibling) === 'preserved') preserved.push(resolve(location.root, sibling));
                } else if (original !== undefined) preserved.push(resolve(location.root, sibling));
                continue;
            }
            if (owner.restore(path, original) === 'preserved') {
                preserved.push(resolve(location.root, path));
                continue;
            }
            if (entries.some((entry) => entry.path === sibling) && owner.restore(sibling) === 'preserved')
                preserved.push(resolve(location.root, sibling));
        }
        return preserved;
    });
}

/** Compare Git's executable hook files with their recorded installed identities. */
export function hookStatus(session: Session): string {
    if (session.policyFiles.policy.hooks === undefined) return 'none';
    if (!session.repository.hasGit) return 'not installed: no Git repository';
    if (session.policyFiles.policy.hooks.tool !== 'gspot')
        return `${session.policyFiles.policy.hooks.tool}: run gspot install to verify integration`;
    const location = hookLocation(session.root);
    const entries = readOwnership(location.root).files;
    const files = openConfinedRoot(location.root);
    try {
        for (const name of HOOK_FILES) {
            const path = `${location.directory}/${name}`;
            const sibling = `${path}.gspot-original`;
            if (entries.some((entry) => entry.path === sibling)) {
                const original = files.read(sibling);
                if (original === undefined || (original.mode & 0o111) === 0)
                    return `${location.absolute}: original ${name} is missing or not executable; restore it from recovery and run gspot install`;
            }
            const current = files.read(path);
            const installed = entries.find((entry) => entry.path === path)?.installed;
            if (
                current === undefined ||
                installed === undefined ||
                current.mode !== installed.mode ||
                new Bun.CryptoHasher('sha256').update(current.bytes).digest('hex') !== installed.hash
            )
                return `${location.absolute}: missing or edited ${name}; run gspot install`;
        }
        return `${location.absolute}: installed`;
    } finally {
        files.close();
    }
}
