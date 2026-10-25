import { formatCount } from '#cli/system/text.ts';
import type { Session } from '#cli/types/session.ts';
import { listExpectedPaths } from '#cli/apply/outdated.ts';
import { listStaleLockfiles } from '#cli/install/tool-projects.ts';
import type { Files, FileContents } from '#cli/types/system/files.ts';
import { type WritePlan, type ApplyReport } from '#cli/types/apply.ts';
import type { GenerationResult } from '#cli/types/generation/files.ts';
import { EXECUTABLE_FILE, OWNER_WRITABLE_FILE } from '#cli/config/files/modes.ts';
import { DOT_GSPOT, GSPOT_PATHS, INSTALLED_TOOL_FOLDERS } from '#cli/config/gspot-folder.ts';
import { HOOKS_CHANGED_NOTE, INSTALL_FIRST_NOTE, INSTALL_MISSING_NOTE } from '#cli/config/apply/generated.ts';
import { planBlock, writePlans, planRemoval, listStrayPaths, planReplacement, planSettingsWrite } from '#cli/write.ts';

/**
Say that the generated files need no change.

@param count how many files gspot generates.
@returns the sentence, with the verb agreeing with the count.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 2 calls in 2 files share it.
export function formatUpToDate(count: number): string {
    return `No change: the ${formatCount(count, 'generated file')} ${count === 1 ? 'is' : 'are'} up to date.`;
}

/**
Format generated file changes and notes for command output.

@param report the applied file changes and notes.
@returns the report text.
*/
export function formatApplyReport(report: ApplyReport): string {
    const lines = [
        ...formatGeneratedChanges('wrote', report.written),
        ...formatGeneratedChanges('updated', report.updated),
        ...formatGeneratedChanges('removed', report.removed),
    ];
    if (lines.length === 0 && report.notes.length === 0) lines.push(formatUpToDate(report.unchanged.length));
    lines.push(...report.notes.map((note) => `note     ${note}`));
    return `${lines.join('\n')}\n`;
}

function removeUnusedToolFolders(writer: Files, paths: ReadonlySet<string>): void {
    for (const [path, keep] of [
        [INSTALLED_TOOL_FOLDERS.npm, paths.has(GSPOT_PATHS.npmProject)],
        [INSTALLED_TOOL_FOLDERS.python, paths.has(GSPOT_PATHS.pythonProject)],
        [INSTALLED_TOOL_FOLDERS.vale, paths.has(GSPOT_PATHS.valeConfigFile)],
    ] as const) {
        if (!keep) writer.deleteTree(path);
    }
}

async function addInstallationNote(session: Session, generated: GenerationResult, report: ApplyReport): Promise<void> {
    const dependenciesChanged = generated.files.some(
        (file) =>
            report.written.includes(file.path) &&
            (file.kind === 'lock' ||
                file.path === GSPOT_PATHS.npmProject ||
                file.path === GSPOT_PATHS.pythonProject ||
                file.path === GSPOT_PATHS.miseProject),
    );
    const lockfiles = await listStaleLockfiles(session, generated.files);
    const hasDrift = lockfiles.some((lockfile) => lockfile.kind !== undefined);
    if (dependenciesChanged) report.notes.push(INSTALL_FIRST_NOTE);
    else if (hasDrift) report.notes.push(INSTALL_MISSING_NOTE);
}

function buildReplacementPlans(
    generated: GenerationResult,
    writer: Files,
    reviewed: ReadonlyMap<string, FileContents | undefined> | undefined,
): WritePlan[] {
    const authorized = new Map(reviewed);
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
Plan, write, and report generated file changes under the repository writer lock.

@param session the repository to write to.
@param generated the files to write, with resolved lockfiles.
@param writer writes and removes files.
@param options what the write may replace.
@param options.reviewed the file contents that you reviewed and approved for replacement.
@returns the file changes.
*/
export async function writeGeneratedFiles(
    session: Session,
    generated: GenerationResult,
    writer: Files,
    options?: { reviewed?: ReadonlyMap<string, FileContents | undefined> | undefined },
): Promise<ApplyReport> {
    const reviewed = options?.reviewed;
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
        return reviewed?.has(output.path) === true ? { ...plan, before: reviewed.get(output.path) } : plan;
    });
    const replacements = buildReplacementPlans(generated, writer, reviewed);
    const blocks = generated.blocks.map((block) => planBlock(writer, block.path, block.block, block.style));
    const generatedPlans = [...replacements, ...blocks, ...managedKeyPlans];
    const pruning = listStrayPaths(session, paths).map((path) => planRemoval(writer, path));
    const plans = [...generatedPlans, ...pruning];
    writePlans(writer, plans);
    removeUnusedToolFolders(writer, paths);
    report.written.push(...replacements.filter((plan) => plan.status === 'changed').map((plan) => plan.path));
    report.unchanged.push(...replacements.filter((plan) => plan.status === 'unchanged').map((plan) => plan.path));
    report.updated.push(
        ...[...blocks, ...managedKeyPlans].filter((plan) => plan.status === 'changed').map((plan) => plan.path),
    );
    const pruned = pruning.filter((plan) => plan.status === 'changed');
    report.removed.push(...pruned.filter((plan) => plan.after === undefined).map(({ path }) => path));
    report.updated.push(...pruned.filter((plan) => plan.after !== undefined).map(({ path }) => path));
    if ([...report.removed, ...report.written].some((path) => path.startsWith(`${GSPOT_PATHS.hooks}/`)))
        report.notes.push(HOOKS_CHANGED_NOTE);
    await addInstallationNote(session, generated, report);
    return report;
}

function formatGeneratedChanges(action: string, paths: string[]): string[] {
    const gspotCount = paths.filter((path) => path.startsWith(`${DOT_GSPOT}/`)).length;
    const outside = paths.filter((path) => !path.startsWith(`${DOT_GSPOT}/`));
    const label = action.padEnd('updated  '.length);
    return [
        ...(gspotCount === 0 ? [] : [`${label}${formatCount(gspotCount, 'generated file')}`]),
        ...outside.map((path) => `${label}${path}`),
    ];
}
