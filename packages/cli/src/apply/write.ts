import { writePlans } from '#cli/ownership/writer.ts';
import type { Session } from '#cli/types/planning.ts';
import type { ApplyReport } from '#cli/types/apply.ts';
import { listExpectedPaths } from '#cli/apply/stale.ts';
import type { FileContents } from '#cli/types/system/files.ts';
import type { Writer, WritePlan } from '#cli/types/ownership.ts';
import { listStaleLockfiles } from '#cli/tools/project-lockfiles.ts';
import type { GenerationResult } from '#cli/types/generation/files.ts';
import { EXECUTABLE_FILE, OWNER_WRITABLE_FILE } from '#cli/config/system/modes.ts';
import { planBlock, planRemoval, listStrayPaths, planManagedKeys, planReplacement } from '#cli/ownership/plans.ts';

import {
    HOOKS_PATH,
    VALE_TOOL_FILE_PATH,
    NPM_TOOL_PROJECT_FILE,
    INSTALLED_TOOL_FOLDERS,
    PYTHON_TOOL_PROJECT_FILE,
} from '#cli/config/system/locations.ts';

/**
 * Explain which files need review before replacement.
 * @param paths the destinations that contain unreviewed authored files.
 * @returns the refusal with the apply command to retry.
 */
function buildPreservedFilesError(paths: string[]): Error {
    return new Error(
        `These files were not overwritten by gspot: ${paths.join(', ')}. Move them aside, then run gspot apply.`,
    );
}

function removeUnusedToolFolders(writer: Writer, paths: ReadonlySet<string>): void {
    for (const [path, keep] of [
        [INSTALLED_TOOL_FOLDERS.npm, paths.has(NPM_TOOL_PROJECT_FILE)],
        [INSTALLED_TOOL_FOLDERS.python, paths.has(PYTHON_TOOL_PROJECT_FILE)],
        [INSTALLED_TOOL_FOLDERS.vale, paths.has(VALE_TOOL_FILE_PATH)],
    ] as const) {
        if (!keep) writer.files.deleteTree(path);
    }
}

function addInstallationNote(session: Session, generated: GenerationResult, report: ApplyReport): void {
    const dependenciesChanged = generated.files.some(
        (file) =>
            report.written.includes(file.path) &&
            (file.kind === 'lock' || [NPM_TOOL_PROJECT_FILE, PYTHON_TOOL_PROJECT_FILE].includes(file.path)),
    );
    const hasDrift = listStaleLockfiles(session, generated.files).some((lockfile) => lockfile.kind !== undefined);
    if (dependenciesChanged || hasDrift) report.notes.push('Tool dependencies need installation. Run: gspot install');
}

function buildReplacementPlans(
    generated: GenerationResult,
    writer: Writer,
    reviewedOriginals: ReadonlyMap<string, FileContents | undefined> | undefined,
): WritePlan[] {
    const authorized = new Map(reviewedOriginals);
    return generated.files.map((file) => {
        const read = file.kind === 'lock' ? file.read : authorized.get(file.path);
        const replacement = {
            bytes: Buffer.from(file.content),
            mode: file.executable === true ? EXECUTABLE_FILE : OWNER_WRITABLE_FILE,
        };
        const plan = planReplacement(writer, {
            path: file.path,
            next: replacement,
            canReplace: read !== undefined,
            expected: read,
        });
        return authorized.has(file.path) ? { ...plan, before: authorized.get(file.path) } : plan;
    });
}

/**
 * Plan, write, and report generated file changes under the repository writer lock.
 *
 * @param session the configuration and repository reads.
 * @param generated the generated files with resolved lockfiles.
 * @param writer the file writer for this command.
 * @param options reviewed originals authorized for replacement.
 *
 * @param options.reviewedOriginals the file contents reviewed before the command asked for approval.
 * @returns generated changes.
 */
export function writeGeneratedFiles(
    session: Session,
    generated: GenerationResult,
    writer: Writer,
    options?: { reviewedOriginals?: ReadonlyMap<string, FileContents | undefined> | undefined },
): ApplyReport {
    const reviewedOriginals = options?.reviewedOriginals;
    const report: ApplyReport = {
        written: [],
        unchanged: [],
        removed: [],
        updated: [],
        notes: [...generated.notes],
    };
    const paths = listExpectedPaths(session, generated);
    const fileEditPlans = generated.fileEdits.map((output) => {
        const plan = planManagedKeys(writer, output.path, output.changes);
        return reviewedOriginals?.has(output.path) === true
            ? { ...plan, before: reviewedOriginals.get(output.path) }
            : plan;
    });
    const replacements = buildReplacementPlans(generated, writer, reviewedOriginals);
    const blocks = generated.blocks.map((block) => planBlock(writer, block.path, block.block, block.style));
    const generatedPlans = [...replacements, ...blocks, ...fileEditPlans];
    // Remove generated destinations that no selected configuration needs.
    const pruning = listStrayPaths(session, paths).map((path) => planRemoval(writer, path));
    const plans = [...generatedPlans, ...pruning];
    const conflicts = plans.filter((plan) => plan.status === 'preserved').map((plan) => plan.path);
    if (reviewedOriginals !== undefined && conflicts.length > 0) throw buildPreservedFilesError(conflicts);
    writePlans(
        writer,
        plans.filter((plan) => plan.status !== 'preserved'),
    );
    removeUnusedToolFolders(writer, paths);
    report.written.push(...replacements.filter((plan) => plan.status === 'changed').map((plan) => plan.path));
    report.unchanged.push(...replacements.filter((plan) => plan.status === 'unchanged').map((plan) => plan.path));
    report.updated.push(
        ...[...blocks, ...fileEditPlans].filter((plan) => plan.status === 'changed').map((plan) => plan.path),
    );
    report.removed.push(...pruning.filter((plan) => plan.status !== 'preserved').map(({ path }) => path));
    if ([...report.removed, ...report.written].some((path) => path.startsWith(`${HOOKS_PATH}/`)))
        report.notes.push('Git hooks changed. Run: gspot install');
    if (conflicts.length > 0) throw buildPreservedFilesError(conflicts);
    addInstallationNote(session, generated, report);
    if (generated.fileEdits.length > 0)
        report.notes.push(
            'Keys that gspot no longer manages stay in your files. Review shared tool files after removing a configuration.',
        );
    return report;
}
