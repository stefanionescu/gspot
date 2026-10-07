// Writing what init prepared: the policy, the generated files, the retirements, and the tool installation.
import { isDeepStrictEqual } from 'node:util';
import { colors } from '#cli/terminal/messages.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { openSession } from '#cli/commands/session.ts';
import { writeOutputs } from '#cli/lifecycle/apply.ts';
import { parseStrictPolicy } from '#cli/policy/read.ts';
import { installTools } from '#cli/lifecycle/install.ts';
import type { FileCopy } from '#cli/types/platform/root.ts';
import { prepareToolProjects } from '#cli/tools/project.ts';
import type { Log } from '#cli/types/lifecycle/ownership.ts';
import { POLICY_FILE } from '#cli/config/platform/locations.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { emitAll, outputPaths } from '#cli/generation/outputs.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/platform/modes.ts';
import type { InitOptions } from '#cli/types/lifecycle/selection.ts';
import { applyPlan, applyPlans } from '#cli/lifecycle/ownership/commit.ts';
import { proposeRetirement, proposeReplacement } from '#cli/lifecycle/ownership/plans.ts';
import type { Written, InitPrepared, RetirementResult } from '#cli/types/commands/init.ts';

// Deletes the replaced files the plan lists, which Git keeps, and retains directories.
function retireReplaced(
    log: Log,
    removed: InitPrepared['removed'],
    read: ReadonlyMap<string, FileCopy | undefined>,
): RetirementResult {
    const result: RetirementResult = { removed: [], preserved: [] };
    const plans = [];
    for (const entry of removed) {
        if (entry.path.endsWith('/')) {
            result.preserved.push(entry.path);
            continue;
        }
        const expected = read.get(entry.path);
        if (expected === undefined)
            throw new GspotError('policy', [`No original file was recorded for ${entry.path}. Run gspot init again.`]);
        const plan = proposeRetirement(log, entry.path, expected);
        plans.push(plan);
        const status = plan.status;
        if (status === 'changed') result.removed.push(entry.path);
        else if (status === 'preserved') result.preserved.push(entry.path);
    }
    applyPlans(
        log,
        plans.filter((plan) => plan.status !== 'preserved'),
    );
    return result;
}

// Refuses writes when an input changed after init read it.
function assertReadUnchanged(log: Log, read: ReadonlyMap<string, FileCopy | undefined>): void {
    for (const [path, original] of read)
        if (!isDeepStrictEqual(log.files.read(path), original))
            throw new GspotError('policy', [
                `Configuration changed after init read it: ${path}. Run gspot init again.`,
            ]);
}

/**
 * Writes the policy and the generated files, retires the replaced configuration, and installs the tools.
 * @param root the repository root
 * @param options whether initialization installs the tools
 * @param prepared what init prepared
 * @returns the lines to print, the installation note, and the exit code
 */
export async function writeSetup(
    root: string,
    options: Pick<InitOptions, 'install'>,
    prepared: InitPrepared,
): Promise<Written> {
    using log = openOwnership(root);
    assertReadUnchanged(log, prepared.read);
    const removedPaths = new Set(prepared.removed.map((entry) => entry.path));
    const reviewedOriginals = new Map(
        [...prepared.read].flatMap(([path, original]) =>
            removedPaths.has(path) && original !== undefined ? [[path, original] as const] : [],
        ),
    );
    const session = await openSession(root, {
        policy: parseStrictPolicy(prepared.policyText, root),
        text: prepared.policyText,
        path: POLICY_FILE,
        problems: [],
    });
    const generated = emitAll(session);
    if (options.install) {
        await prepareToolProjects(session, generated.files, log.files, { refreshLockfiles: false });
    }
    assertReadUnchanged(log, prepared.read);
    applyPlan(
        log,
        proposeReplacement(log, {
            path: POLICY_FILE,
            next: { bytes: Buffer.from(prepared.policyText), mode: OWNER_WRITABLE_FILE },
            kind: 'policy',
            canReplace: true,
        }),
    );
    log.state.selections = prepared.selections;
    log.save();
    const generatedPaths = outputPaths(generated);
    const applied = writeOutputs(session, log, reviewedOriginals, generated);
    const retired = retireReplaced(
        log,
        prepared.removed.filter((entry) => !generatedPaths.has(entry.path)),
        prepared.read,
    );
    applied.notes.push(
        ...retired.preserved.map((path) => `kept ${path}: it is a folder, or it changed after init read it`),
    );
    const installed = options.install
        ? await installTools(session, log, generated, { refreshLockfiles: false })
        : { note: 'install skipped; run: gspot install', exitCode: 0 };
    const version = colors.dim(`gspot ${session.version}`);
    return {
        lines: ['written: gspot.toml, .gspot/', ...applied.notes, installed.note, version, ''],
        installNote: installed.note,
        exitCode: installed.exitCode,
    };
}
