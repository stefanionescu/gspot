import { formatCount } from '#cli/system/text.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { findValueAt } from '#cli/system/tables.ts';
import { readHooks } from '#cli/repository/setup.ts';
import { GSPOT_FOLDER } from '#cli/config/parsers.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { listOwnablePaths } from '#cli/generation/links.ts';
import type { ApplyReport } from '#cli/types/generation.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import type { Session, Generation } from '#cli/types/tools.ts';
import { listExpectedPaths } from '#cli/generation/outdated.ts';
import { isGspotPath } from '#cli/repository/files/classify.ts';
import type { Files, FileContents } from '#cli/types/system.ts';
import { EXECUTABLE_FILE } from '#cli/config/repository/files.ts';
import { listStaleLockfiles } from '#cli/tools/installers/projects.ts';
import { SCANNER_KEY, BUNFIG_FILE } from '#cli/config/configurations/general.ts';
import { OWNER_WRITABLE_FILE, INSTALLED_TOOL_FOLDERS } from '#cli/config/repository/setup.ts';

import {
    planBlock,
    writePlans,
    planRemovals,
    listStrayPaths,
    planManagedKeys,
    planReplacements,
} from '#cli/repository/writer.ts';
import {
    MANAGED_KEYS_NOTE,
    CHANGE_LABEL_WIDTH,
    TOOL_PROJECT_FILES,
    HOOKS_CHANGED_NOTE,
    TOOLS_CHANGED_NOTE,
    GENERATED_FILE_NOUN,
    STALE_LOCKFILE_NOTE,
} from '#cli/config/generation.ts';

function deleteUnusedToolFolders(writer: Files, paths: ReadonlySet<string>): void {
    for (const [path, keep] of [
        [INSTALLED_TOOL_FOLDERS.npm, paths.has(GSPOT_PATHS.npmProject)],
        [INSTALLED_TOOL_FOLDERS.python, paths.has(GSPOT_PATHS.pythonProject)],
        [INSTALLED_TOOL_FOLDERS.vale, paths.has(GSPOT_PATHS.valeConfig)],
    ] as const) {
        if (!keep) writer.deleteTree(path);
    }
}

function addInstallationNote(session: Session, generated: Generation, report: ApplyReport): void {
    const lockfiles = listStaleLockfiles(session, generated.files);
    if (lockfiles.length === 0) return;
    const toolsChanged = report.written.some((path) => TOOL_PROJECT_FILES.includes(path));
    report.notes.push(toolsChanged ? TOOLS_CHANGED_NOTE : STALE_LOCKFILE_NOTE);
}

function hasUnmanagedScanner(session: Session, writer: Files): boolean {
    for (const scope of session.scopes) {
        if (getTable(scope.settings, 'dependencies').bun_scanner !== undefined) continue;
        const path = joinScope(scope.path, BUNFIG_FILE);
        const previous = writer.read(path);
        if (
            previous !== undefined &&
            findValueAt(parseTomlFile(path, previous.bytes.toString('utf8')), SCANNER_KEY) !== undefined
        )
            return true;
    }
    return false;
}

function formatGeneratedChanges(action: string, paths: string[]): string[] {
    const gspotCount = paths.filter((path) => isGspotPath(path)).length;
    const outside = paths.filter((path) => !isGspotPath(path));
    const label = action.padEnd(CHANGE_LABEL_WIDTH);
    return [
        ...(gspotCount === 0 ? [] : [`${label}${formatCount(gspotCount, GENERATED_FILE_NOUN)} in ${GSPOT_FOLDER}/`]),
        ...outside.map((path) => `${label}${path}`),
    ];
}

/**
Format generated file changes and notes for command output.

@param report the applied file changes and notes.
*/
export function formatApplyReport(report: ApplyReport): string {
    const lines = [
        ...formatGeneratedChanges('wrote', report.written),
        ...formatGeneratedChanges('updated', report.updated),
        ...formatGeneratedChanges('removed', report.removed),
    ];
    if (lines.length === 0) {
        const count = report.unchanged.length;
        lines.push(
            `No change: the ${formatCount(count, GENERATED_FILE_NOUN)} ${count === 1 ? 'is' : 'are'} up to date.`,
        );
    }
    lines.push(...report.notes.map((note) => `note     ${note}`));
    return `${lines.join('\n')}\n`;
}

/**
Plan, write, and report generated file changes.

@param session the repository to write to.
@param generated the files to write, with resolved lockfiles.
@param writer writes and removes files.
@param options what the write may replace.
@param options.reviewed the file contents that you reviewed and approved for replacement.
*/
export async function writeGeneratedFiles(
    session: Session,
    generated: Generation,
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
    const managedKeyPlans = generated.managedKeys.map((output) => planManagedKeys(writer, output.path, output.keys));
    const replacements = planReplacements(
        writer,
        generated.files.map((file) => ({
            path: file.path,
            next: {
                bytes: Buffer.from(file.content),
                mode: file.executable === true ? EXECUTABLE_FILE : OWNER_WRITABLE_FILE,
            },
            previous: reviewed?.get(file.path),
        })),
    );
    const blocks = generated.blocks.map((block) => planBlock(writer, block.path, block.body));
    const pruning = planRemovals(writer, listStrayPaths(session, paths, listOwnablePaths(session)));
    writePlans(writer, [...replacements, ...managedKeyPlans, ...blocks, ...pruning]);
    deleteUnusedToolFolders(writer, paths);
    report.written.push(...replacements.filter((plan) => plan.status === 'changed').map((plan) => plan.path));
    report.unchanged.push(...replacements.filter((plan) => plan.status === 'unchanged').map((plan) => plan.path));
    report.updated.push(
        ...[...blocks, ...managedKeyPlans].filter((plan) => plan.status === 'changed').map((plan) => plan.path),
    );
    const pruned = pruning.filter((plan) => plan.status === 'changed');
    report.removed.push(...pruned.filter((plan) => plan.after === undefined).map(({ path }) => path));
    report.updated.push(...pruned.filter((plan) => plan.after !== undefined).map(({ path }) => path));
    const { hooksPath } = await readHooks(session.repository);
    if (
        hooksPath !== GSPOT_PATHS.hooks &&
        [...report.removed, ...report.written].some((path) => path.startsWith(`${GSPOT_PATHS.hooks}/`))
    )
        report.notes.push(HOOKS_CHANGED_NOTE);
    if (hasUnmanagedScanner(session, writer)) report.notes.push(MANAGED_KEYS_NOTE);
    addInstallationNote(session, generated, report);
    return report;
}
