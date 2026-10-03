// Writing what init prepared: the policy, the generated files, the retirements, and the tool installation.
import { isDeepStrictEqual } from 'node:util';
import { colors } from '#cli/output/messages.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { emitAll } from '#cli/generation/outputs.ts';
import { writeOutputs } from '#cli/lifecycle/write.ts';
import { gitignoreBlock } from '#cli/kits/manifests.ts';
import { openSession } from '#cli/execution/session.ts';
import type { Session } from '#cli/types/tools/tools.ts';
import type { Read } from '#cli/types/platform/platform.ts';
import { asOwner } from '#cli/lifecycle/ownership/owner.ts';
import { isGitRepository } from '#cli/repository/tracked.ts';
import type { Owner } from '#cli/types/lifecycle/lifecycle.ts';
import { finishInstall } from '#cli/commands/install/steps.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import { OWNER_WRITABLE_FILE } from '#cli/config/platform/platform.ts';
import type { Written, InitOptions, InitPrepared, ReplaceRemovalResult } from '#cli/types/commands/init.ts';

const { version: RUNNING_VERSION } = packageManifest;

// Deletes the replaced files the plan lists, which Git keeps, and retains directories.
function retireReplaced(
    root: string,
    removed: { path: string }[],
    read: ReadonlyMap<string, Read>,
): ReplaceRemovalResult {
    return asOwner(root, (owner) => {
        const result: ReplaceRemovalResult = { removed: [], preserved: [] };
        const plans = [];
        for (const entry of removed) {
            if (entry.path.endsWith('/')) {
                result.preserved.push(entry.path);
                continue;
            }
            const expected = read.get(entry.path);
            if (expected === undefined) throw new Error(`No replace read exists for ${entry.path}.`);
            const plan = owner.proposeRetirement(entry.path, expected);
            plans.push(plan);
            const status = plan.status;
            if (status === 'changed') result.removed.push(entry.path);
            else if (status === 'preserved') result.preserved.push(entry.path);
        }
        owner.applyPlans(plans.filter((plan) => plan.status !== 'preserved'));
        return result;
    });
}

// Refuses to write when a configuration the replace read has changed after the plan was made.
function assertReadUnchanged(owner: Owner, read: ReadonlyMap<string, Read>): void {
    for (const [path, original] of read)
        if (!isDeepStrictEqual(owner.read(path), original))
            throw new GspotError('policy', [
                `Configuration changed after replace was planned: ${path}. Run gspot init again.`,
            ]);
}

// The paths every generated output lands on.
function generatedPaths(session: Session): Set<string> {
    const outputs = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageClient: session.packageClient,
    });
    const every = [...outputs.files, ...outputs.blocks, ...outputs.merges, ...outputs.configurations];
    return new Set(every.map((output) => output.path));
}

/**
 * Writes the policy and the generated files, retires the replaced configuration, and installs the tools.
 * @param root the repository root
 * @param options the init options
 * @param prepared what init prepared
 * @returns the lines to print, the installation note, and the exit code
 */
export async function write(root: string, options: InitOptions, prepared: InitPrepared): Promise<Written> {
    return asOwner(root, async (owner) => {
        assertReadUnchanged(owner, prepared.read);
        const removedPaths = new Set(prepared.removed.map((entry) => entry.path));
        const replace = new Map([...prepared.read].filter(([path]) => removedPaths.has(path)));
        owner.replace(
            'gspot.toml',
            { bytes: Buffer.from(prepared.policyText), mode: OWNER_WRITABLE_FILE },
            'policy',
            true,
        );
        if (isGitRepository(root)) owner.replaceBlock('.gitignore', gitignoreBlock(), 'hash');
        const session = await openSession(root);
        const generated = generatedPaths(session);
        const synced = await writeOutputs(session, replace);
        const retired = retireReplaced(
            root,
            prepared.removed.filter((entry) => !generated.has(entry.path)),
            prepared.read,
        );
        synced.notes.push(
            ...retired.preserved.map(
                (path) => `retained ${path}: directory contents or subsequent edits are not authorized for deletion`,
            ),
        );
        const { installNote, exitCode } = await finishInstall(session, options.install);
        const version = colors.dim(`gspot ${RUNNING_VERSION}`);
        return {
            lines: ['written: gspot.toml, .gspot/', ...synced.notes, installNote, version, ''],
            installNote,
            exitCode,
        };
    });
}
