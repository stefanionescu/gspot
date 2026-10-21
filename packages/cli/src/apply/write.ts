import { writePlans } from '#cli/ownership/writer.ts';
import type { Session } from '#cli/types/planning.ts';
import type { ApplyReport } from '#cli/types/apply.ts';
import { listExpectedPaths } from '#cli/apply/stale.ts';
import { listStaleLockfiles } from '#cli/install/lockfiles.ts';
import type { FileContents } from '#cli/types/system/files.ts';
import type { Writer, WritePlan } from '#cli/types/ownership.ts';
import { planSettingsWrite } from '#cli/ownership/file-settings.ts';
import type { GenerationResult } from '#cli/types/generation/files.ts';
import { EXECUTABLE_FILE, OWNER_WRITABLE_FILE } from '#cli/config/system/modes.ts';
import { FILE_EDITS_NOTE, HOOKS_CHANGED_NOTE, INSTALL_NEEDED_NOTE } from '#cli/config/apply.ts';
import { planBlock, planRemoval, listStrayPaths, planReplacement } from '#cli/ownership/plans.ts';

import {
    HOOKS_PATH,
    VALE_TOOL_FILE_PATH,
    NPM_TOOL_PROJECT_FILE,
    INSTALLED_TOOL_FOLDERS,
    PYTHON_TOOL_PROJECT_FILE,
} from '#cli/config/system/locations.ts';

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
    if (dependenciesChanged || hasDrift) report.notes.push(INSTALL_NEEDED_NOTE);
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
            expected: read,
        });
        return authorized.has(file.path) ? { ...plan, before: authorized.get(file.path) } : plan;
    });
}

/**
 * Plan, write, and report generated file changes under the repository writer lock.
 *
 * @param session the repository to write to.
 * @param generated the files to write, with resolved lockfiles.
 * @param writer writes and removes files.
 * @param options what the write may replace.
 * @param options.reviewedOriginals the file contents that you reviewed and approved for replacement.
 * @returns the file changes.
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
        notes: [],
    };
    const paths = listExpectedPaths(session, generated);
    const fileEditPlans = generated.fileSettings.map((output) => {
        const plan = planSettingsWrite(writer, output.path, output.changes);
        return reviewedOriginals?.has(output.path) === true
            ? { ...plan, before: reviewedOriginals.get(output.path) }
            : plan;
    });
    const replacements = buildReplacementPlans(generated, writer, reviewedOriginals);
    const blocks = generated.blocks.map((block) => planBlock(writer, block.path, block.block, block.style));
    const generatedPlans = [...replacements, ...blocks, ...fileEditPlans];
    // Remove generated files that no configuration needs.
    const pruning = listStrayPaths(session, paths).map((path) => planRemoval(writer, path));
    const plans = [...generatedPlans, ...pruning];
    writePlans(writer, plans);
    removeUnusedToolFolders(writer, paths);
    report.written.push(...replacements.filter((plan) => plan.status === 'changed').map((plan) => plan.path));
    report.unchanged.push(...replacements.filter((plan) => plan.status === 'unchanged').map((plan) => plan.path));
    report.updated.push(
        ...[...blocks, ...fileEditPlans].filter((plan) => plan.status === 'changed').map((plan) => plan.path),
    );
    report.removed.push(...pruning.map(({ path }) => path));
    if ([...report.removed, ...report.written].some((path) => path.startsWith(`${HOOKS_PATH}/`)))
        report.notes.push(HOOKS_CHANGED_NOTE);
    addInstallationNote(session, generated, report);
    if (generated.fileSettings.length > 0) report.notes.push(FILE_EDITS_NOTE);
    return report;
}
