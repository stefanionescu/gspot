import { expectedPaths } from '#cli/apply/stale.ts';
import { type Writer } from '#cli/types/ownership.ts';
import { type Session } from '#cli/types/planning.ts';
import { readSettingsFile } from '#cli/settings/file.ts';
import { writeVersionPin } from '#cli/apply/version-pin.ts';
import { type Generated } from '#cli/types/generation/files.ts';
import { listStaleLockfiles } from '#cli/tools/project-lockfiles.ts';
import { type ApplyReport, type WriteRequest } from '#cli/types/apply.ts';
import { writePlans, notOverwrittenError } from '#cli/ownership/writer.ts';
import { EXECUTABLE_FILE, OWNER_WRITABLE_FILE } from '#cli/config/system/modes.ts';
import { planBlock, planRemoval, listStrayPaths, planManagedKeys, planReplacement } from '#cli/ownership/plans.ts';

import {
    VALE_CONFIG,
    HOOKS_DIRECTORY,
    NPM_TOOL_PROJECT_FILE,
    INSTALLED_TOOL_FOLDERS,
    PYTHON_TOOL_PROJECT_FILE,
} from '#cli/config/system/locations.ts';

// An installation no selected configuration needs any more goes whole, and so do the Vale packages once nothing checks prose.
function pruneToolFolders(log: Writer, retained: WriteRequest['retained']): void {
    for (const [kind, keep] of [
        ['npm', retained.packages],
        ['python', retained.python],
        ['vale', retained.prose],
    ] as const) {
        if (keep) continue;
        log.files.removeTree(INSTALLED_TOOL_FOLDERS[kind]);
    }
}

/**
 * Writes generated files and removes recorded files no configuration needs. Plans precede writes.
 *
 * @param session the current settings and file inventory.
 * @param log the locked file writer.
 * @param request generated files, pruning settings, and reviewed originals.
 */
function writeGenerated(session: Session, log: Writer, request: WriteRequest): void {
    const { generated, expectedPaths: expected, report, retained, reviewedOriginals } = request;
    const toolFiles = generated.fileEdits.map((output) => {
        const plan = planManagedKeys(log, output.path, output.changes);
        return reviewedOriginals?.has(output.path) === true
            ? { ...plan, before: reviewedOriginals.get(output.path) }
            : plan;
    });
    const authorized = new Map(reviewedOriginals);
    const replacements = generated.files.map((file) => {
        // Replace reviewed originals and files with merge conflict markers.
        const read = file.kind === 'lock' ? file.read : authorized.get(file.path);
        const replacement = {
            bytes: Buffer.from(file.content),
            mode: file.executable === true ? EXECUTABLE_FILE : OWNER_WRITABLE_FILE,
        };
        const plan = planReplacement(log, {
            path: file.path,
            next: replacement,
            canReplace: read !== undefined,
            expected: read,
        });
        return authorized.has(file.path) ? { ...plan, before: authorized.get(file.path) } : plan;
    });
    const blocks = generated.blocks.map((block) => planBlock(log, block.path, block.block, block.style));
    const generatedPlans = [...replacements, ...blocks, ...toolFiles];
    // Pruning restores only recorded files no selected owner needs.
    const pruning = listStrayPaths(session, expected).map((path) => planRemoval(log, path));
    const plans = [...generatedPlans, ...pruning];
    const conflicts = plans.filter((plan) => plan.status === 'preserved').map((plan) => plan.path);
    if (reviewedOriginals !== undefined && conflicts.length > 0)
        throw notOverwrittenError(conflicts, 'run gspot apply');
    writePlans(
        log,
        plans.filter((plan) => plan.status !== 'preserved'),
    );
    pruneToolFolders(log, retained);
    report.written.push(...replacements.filter((plan) => plan.status === 'changed').map((plan) => plan.path));
    report.unchanged.push(...replacements.filter((plan) => plan.status === 'unchanged').map((plan) => plan.path));
    report.updated.push(
        ...[...blocks, ...toolFiles].filter((plan) => plan.status === 'changed').map((plan) => plan.path),
    );
    report.removed.push(...pruning.filter((plan) => plan.status !== 'preserved').map(({ path }) => path));
    if ([...report.removed, ...report.written].some((path) => path.startsWith(`${HOOKS_DIRECTORY}/`)))
        report.notes.push('Git hooks changed. Run: gspot install');
    if (conflicts.length > 0) throw notOverwrittenError(conflicts, 'run gspot apply');
}

/**
 * Apply generated plans through the repository's ownership log.
 *
 * @param session the configuration and repository reads.
 * @param generated the generated files with resolved lockfiles.
 * @param log the command's locked ownership log.
 * @param options reviewed originals authorized for replacement.
 *
 * @returns generated changes.
 */
export function writeGeneratedFiles(
    session: Session,
    generated: Generated,
    log: Writer,
    options?: Pick<WriteRequest, 'reviewedOriginals'>,
): ApplyReport {
    // Generation requires a valid settings. Refuse errors before writing proposed files.

    if (readSettingsFile(session.root).text !== session.settingsFile.text)
        throw new Error('The gspot.toml file changed while gspot was running. Run the command again.');
    const reviewedOriginals = options?.reviewedOriginals;
    const report: ApplyReport = {
        written: [],
        unchanged: [],
        removed: [],
        updated: [],
        notes: [...generated.notes],
    };
    const paths = expectedPaths(session, generated);
    writeGenerated(session, log, {
        generated,
        expectedPaths: paths,
        report,
        retained: {
            prose: paths.has(VALE_CONFIG),
            packages: paths.has(NPM_TOOL_PROJECT_FILE),
            python: paths.has(PYTHON_TOOL_PROJECT_FILE),
        },
        reviewedOriginals,
    });
    const dependenciesChanged = generated.files.some(
        (file) =>
            report.written.includes(file.path) &&
            (file.kind === 'lock' || [NPM_TOOL_PROJECT_FILE, PYTHON_TOOL_PROJECT_FILE].includes(file.path)),
    );
    const hasDrift = listStaleLockfiles(session, generated.files).some((lockfile) => lockfile.kind !== undefined);
    if (dependenciesChanged || hasDrift) report.notes.push('Tool dependencies need installation. Run: gspot install');
    if (generated.fileEdits.length > 0)
        report.notes.push(
            'Keys that gspot no longer manages stay in your files. Review shared tool files after removing a configuration.',
        );
    writeVersionPin(log);
    return report;
}
