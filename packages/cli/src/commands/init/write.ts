// Writing what init prepared: the policy, the generated files, the retirements, and the tool installation.
import { isDeepStrictEqual } from 'node:util';
import { colors } from '#cli/output/messages.ts';
import { PolicyError } from '#cli/policy/read.ts';
import { emitAll } from '#cli/generation/render.ts';
import { installTools } from '#cli/tools/install.ts';
import { InstallationError } from '#cli/tools/pins.ts';
import { openSession } from '#cli/execution/session.ts';
import { MissingToolError } from '#cli/tools/inspect.ts';
import type { FileSnapshot } from '#cli/types/platform.ts';
import { applyAll } from '#cli/commands/apply/workflow.ts';
import packageManifest from '#package' with { type: 'json' };
import { isGitRepository } from '#cli/repository/tracked.ts';
import type { Session } from '#cli/types/execution/execution.ts';
import { OWNER_WRITABLE_FILE } from '#cli/constants/platform.ts';
import { withLifecycleOwner } from '#cli/lifecycle/ownership/owner.ts';
import { gitignoreBlock } from '#cli/configurations/manifests.ts';
import { INCOMPLETE_INSTALL_EXIT } from '#cli/constants/commands/init.ts';
import type { LifecycleOwner, TakeoverRemovalResult } from '#cli/types/lifecycle/lifecycle.ts';
import type { Installed, Written, InitOptions, InitPrepared } from '#cli/types/commands/init.ts';

const { version: GSPOT_VERSION } = packageManifest;
// Retire explicitly replaced files after saving recoverable originals; retain directories.
function retireReplaced(
    root: string,
    removed: { path: string }[],
    observed: ReadonlyMap<string, FileSnapshot>,
): TakeoverRemovalResult {
    return withLifecycleOwner(root, (owner) => {
        const result: TakeoverRemovalResult = { removed: [], preserved: [] };
        const proposals = [];
        for (const entry of removed) {
            if (entry.path.endsWith('/')) {
                result.preserved.push(entry.path);
                continue;
            }
            const expected = observed.get(entry.path);
            if (expected === undefined) throw new Error(`No takeover observation exists for ${entry.path}.`);
            const proposal = owner.proposeRetirement(entry.path, expected);
            proposals.push(proposal);
            const status = proposal.status;
            if (status === 'changed') result.removed.push(entry.path);
            else if (status === 'preserved') result.preserved.push(entry.path);
        }
        owner.applyProposals(proposals.filter((proposal) => proposal.status !== 'preserved'));
        return result;
    });
}

// Refuses to write when a configuration the takeover read has changed since the plan was made.
function assertObservedUnchanged(owner: LifecycleOwner, observed: ReadonlyMap<string, FileSnapshot>): void {
    for (const [path, original] of observed)
        if (!isDeepStrictEqual(owner.read(path), original))
            throw new PolicyError([`Configuration changed after takeover was planned: ${path}. Run gspot init again.`]);
}

// The paths every generated output lands on.
function generatedPaths(session: Session, takeover: ReadonlyMap<string, FileSnapshot>): Set<string> {
    const outputs = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageManager: session.packageManager,
        takeover,
    });
    const every = [...outputs.files, ...outputs.blocks, ...outputs.merges, ...outputs.configurations];
    return new Set(every.map((output) => output.path));
}

// Whether every failure of an installation is one a later gspot install can repair.
function isRepairable(error: unknown): error is AggregateError {
    if (!(error instanceof AggregateError)) return false;
    return error.errors.every(
        (failure: unknown) => failure instanceof MissingToolError || failure instanceof InstallationError,
    );
}

// Installs the tools, or reports an incomplete installation the setup can live with.
async function installed(session: Session, install: boolean): Promise<Installed> {
    try {
        return { installNote: await installTools(session, install), exitCode: 0 };
    } catch (error) {
        if (!isRepairable(error)) throw error;
        const installNote = `${error.message}\nSetup was written; tool installation is incomplete. Run: gspot install`;
        return { installNote, exitCode: INCOMPLETE_INSTALL_EXIT };
    }
}

/**
 * Writes the policy and the generated files, retires the replaced configuration, and installs the tools.
 * @param root the repository root
 * @param options the init options
 * @param prepared what init prepared
 * @returns the lines to print, the installation note, and the exit code
 */
export async function write(root: string, options: InitOptions, prepared: InitPrepared): Promise<Written> {
    return withLifecycleOwner(root, async (owner) => {
        assertObservedUnchanged(owner, prepared.observed);
        const removedPaths = new Set(prepared.removed.map((entry) => entry.path));
        const takeover = new Map([...prepared.observed].filter(([path]) => removedPaths.has(path)));
        owner.replace(
            'gspot.toml',
            { bytes: Buffer.from(prepared.policyText), mode: OWNER_WRITABLE_FILE },
            'policy',
            true,
        );
        if (isGitRepository(root)) owner.replaceBlock('.gitignore', gitignoreBlock(), 'hash');
        const session = await openSession(root);
        const generated = generatedPaths(session, takeover);
        const synced = await applyAll(session, takeover);
        const retired = retireReplaced(
            root,
            prepared.removed.filter((entry) => !generated.has(entry.path)),
            prepared.observed,
        );
        synced.notes.push(
            ...retired.preserved.map(
                (path) => `retained ${path}: directory contents or subsequent edits are not authorized for deletion`,
            ),
        );
        const { installNote, exitCode } = await installed(session, options.install);
        const version = colors.dim(`gspot ${GSPOT_VERSION}`);
        return {
            lines: ['written: gspot.toml, .gspot/', ...synced.notes, installNote, version, ''],
            installNote,
            exitCode,
        };
    });
}
