import { formatCount } from '#cli/system/text.ts';
import type { Session } from '#cli/types/session.ts';
import { writePlans } from '#cli/apply/write/writer.ts';
import type { FileContents } from '#cli/types/system/files.ts';
import { listExpectedPaths } from '#cli/apply/outdated-files.ts';
import { listStaleLockfiles } from '#cli/install/tool-projects.ts';
import { planSettingsWrite } from '#cli/apply/write/managed-keys.ts';
import type { GenerationResult } from '#cli/types/generation/files.ts';
import { EXECUTABLE_FILE, OWNER_WRITABLE_FILE } from '#cli/config/files/modes.ts';
import { GSPOT_PATHS, INSTALLED_TOOL_FOLDERS } from '#cli/config/gspot-folder.ts';
import { type Writer, type WritePlan, type ApplyReport } from '#cli/types/apply.ts';
import { planBlock, planRemoval, listStrayPaths, planReplacement } from '#cli/apply/write/plans.ts';
import { MANAGED_KEYS_NOTE, HOOKS_CHANGED_NOTE, INSTALL_NEEDED_NOTE } from '#cli/config/apply/generated-files.ts';

/**
 * Say that the generated files need no change.
 *
 * @param count how many files gspot generates.
 * @returns the sentence, with the verb agreeing with the count.
 */
export function formatUpToDate(count: number): string {
    return `No change: the ${formatCount(count, 'generated file')} ${count === 1 ? 'is' : 'are'} up to date.`;
}

/**
 * Format generated file changes and notes for command output.
 *
 * @param report the applied file changes and notes.
 * @returns the report text.
 */
export function formatApplyReport(report: ApplyReport): string {
    const lines = [
        ...report.written.map((path) => `wrote    ${path}`),
        ...report.updated.map((path) => `updated  ${path}`),
        ...report.removed.map((path) => `removed  ${path}`),
    ];
    if (lines.length === 0 && report.notes.length === 0) lines.push(formatUpToDate(report.unchanged.length));
    lines.push(...report.notes.map((note) => `note     ${note}`));
    return `${lines.join('\n')}\n`;
}

function removeUnusedToolFolders(writer: Writer, paths: ReadonlySet<string>): void {
    for (const [path, keep] of [
        [INSTALLED_TOOL_FOLDERS.npm, paths.has(GSPOT_PATHS.npmProject)],
        [INSTALLED_TOOL_FOLDERS.python, paths.has(GSPOT_PATHS.pythonProject)],
        [INSTALLED_TOOL_FOLDERS.vale, paths.has(GSPOT_PATHS.valeConfigFile)],
    ] as const) {
        if (!keep) writer.files.deleteTree(path);
    }
}

function addInstallationNote(session: Session, generated: GenerationResult, report: ApplyReport): void {
    const dependenciesChanged = generated.files.some(
        (file) =>
            report.written.includes(file.path) &&
            (file.kind === 'lock' || file.path === GSPOT_PATHS.npmProject || file.path === GSPOT_PATHS.pythonProject),
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
    const managedKeyPlans = generated.managedKeys.map((output) => {
        const plan = planSettingsWrite(writer, output.path, output.keys);
        return reviewedOriginals?.has(output.path) === true
            ? { ...plan, before: reviewedOriginals.get(output.path) }
            : plan;
    });
    const replacements = buildReplacementPlans(generated, writer, reviewedOriginals);
    const blocks = generated.blocks.map((block) => planBlock(writer, block.path, block.block, block.style));
    const generatedPlans = [...replacements, ...blocks, ...managedKeyPlans];
    // Remove generated files that no configuration needs.
    const pruning = listStrayPaths(session, paths).map((path) => planRemoval(writer, path));
    const plans = [...generatedPlans, ...pruning];
    writePlans(writer, plans);
    removeUnusedToolFolders(writer, paths);
    report.written.push(...replacements.filter((plan) => plan.status === 'changed').map((plan) => plan.path));
    report.unchanged.push(...replacements.filter((plan) => plan.status === 'unchanged').map((plan) => plan.path));
    report.updated.push(
        ...[...blocks, ...managedKeyPlans].filter((plan) => plan.status === 'changed').map((plan) => plan.path),
    );
    report.removed.push(...pruning.map(({ path }) => path));
    if ([...report.removed, ...report.written].some((path) => path.startsWith(`${GSPOT_PATHS.hooks}/`)))
        report.notes.push(HOOKS_CHANGED_NOTE);
    addInstallationNote(session, generated, report);
    if (generated.managedKeys.length > 0) report.notes.push(MANAGED_KEYS_NOTE);
    return report;
}
