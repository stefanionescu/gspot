// Writing what init prepared: the policy, the generated files, the retirements, and the tool installation.
import { colors } from '#cli/terminal/messages.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { writePolicyFile } from '#cli/policy/file.ts';
import { openSession } from '#cli/commands/session.ts';
import { parseStrictPolicy } from '#cli/policy/read.ts';
import { installTools } from '#cli/lifecycle/install.ts';
import type { FileCopy } from '#cli/types/platform/root.ts';
import { prepareToolProjects } from '#cli/tools/project.ts';
import type { Log } from '#cli/types/lifecycle/ownership.ts';
import { writeGeneratedFiles } from '#cli/lifecycle/apply.ts';
import { POLICY_FILE } from '#cli/config/platform/locations.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { emitAll, generatedPaths } from '#cli/generation/files.ts';
import type { InitOptions } from '#cli/types/lifecycle/selection.ts';
import { applyPlan, applyPlans } from '#cli/lifecycle/ownership/commit.ts';
import { planRetirement, planReplacement } from '#cli/lifecycle/ownership/plans.ts';
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
        const plan = planRetirement(log, entry.path, expected);
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
    const session = await openSession(root, {
        policy: parseStrictPolicy(prepared.policyText, root),
        text: prepared.policyText,
        path: POLICY_FILE,
        errors: [],
    });
    const generated = emitAll(session);
    if (options.install) {
        await prepareToolProjects(session, generated.files, log.files, { refreshLockfiles: false });
    }
    writePolicyFile({
        files: log.files,
        text: prepared.policyText,
        original: prepared.read.get(POLICY_FILE),
        publish: (next, expected) => {
            applyPlan(log, {
                ...planReplacement(log, { path: POLICY_FILE, next, kind: 'policy', canReplace: true, expected }),
                before: expected,
            });
        },
    });
    const destinations = generatedPaths(generated);
    const applied = writeGeneratedFiles(session, log, prepared.read, generated);
    const retired = retireReplaced(
        log,
        prepared.removed.filter((entry) => !destinations.has(entry.path)),
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
