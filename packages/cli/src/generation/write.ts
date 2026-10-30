import { formatCount } from '#cli/system/text.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { getValueAt } from '#cli/system/tables.ts';
import { readHooks } from '#cli/repository/setup.ts';
import type { Session } from '#cli/types/session.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { listExpectedPaths } from '#cli/generation/outdated.ts';
import { listStaleLockfiles } from '#cli/installers/projects.ts';
import type { Files, FileContents } from '#cli/types/system/files.ts';
import { listOwnablePaths } from '#cli/generation/config-files/link-files.ts';
import { EXECUTABLE_FILE, OWNER_WRITABLE_FILE } from '#cli/config/files/modes.ts';
import { type Generation, type ApplyReport } from '#cli/types/generation/files.ts';
import { GSPOT_PATHS, GSPOT_FOLDER, INSTALLED_TOOL_FOLDERS } from '#cli/config/gspot-folder.ts';
import { SCANNER_KEY, BUNFIG_FILE } from '#cli/config/generation/configurations/general/dependencies.ts';

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
} from '#cli/config/generation/write.ts';

/**
Say that the generated files need no change.

@param count how many files gspot generates.
@returns the sentence, with the verb agreeing with the count.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The apply command and its dry run print this one sentence.
export function formatUpToDate(count: number): string {
    return `No change: the ${formatCount(count, GENERATED_FILE_NOUN)} ${count === 1 ? 'is' : 'are'} up to date.`;
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
    if (lines.length === 0 && report.notes.length === 0) lines.push(formatUpToDate(report.unchanged.length));
    lines.push(...report.notes.map((note) => `note     ${note}`));
    return `${lines.join('\n')}\n`;
}

function deleteUnusedToolFolders(writer: Files, paths: ReadonlySet<string>, generated: Generation): void {
    for (const [path, keep] of [
        [INSTALLED_TOOL_FOLDERS.npm, paths.has(GSPOT_PATHS.npmProject)],
        [INSTALLED_TOOL_FOLDERS.python, paths.has(GSPOT_PATHS.pythonProject)],
        [
            INSTALLED_TOOL_FOLDERS.vale,
            generated.files.some(
                (file) => file.path === GSPOT_PATHS.valeConfigFile && file.content.includes('Packages = '),
            ),
        ],
    ] as const) {
        if (!keep) writer.deleteTree(path);
    }
}

async function addInstallationNote(session: Session, generated: Generation, report: ApplyReport): Promise<void> {
    const lockfiles = await listStaleLockfiles(session, generated.files);
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
            getValueAt(parseTomlFile(path, previous.bytes.toString('utf8')), SCANNER_KEY) !== undefined
        )
            return true;
    }
    return false;
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
            expected: reviewed?.get(file.path),
        })),
    );
    const blocks = generated.blocks.map((block) => planBlock(writer, block.path, block.body));
    const pruning = planRemovals(writer, listStrayPaths(session, paths, listOwnablePaths(session)));
    writePlans(writer, [...replacements, ...managedKeyPlans, ...blocks, ...pruning]);
    deleteUnusedToolFolders(writer, paths, generated);
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
    await addInstallationNote(session, generated, report);
    return report;
}

function formatGeneratedChanges(action: string, paths: string[]): string[] {
    const gspotCount = action === 'removed' ? 0 : paths.filter((path) => path.startsWith(`${GSPOT_FOLDER}/`)).length;
    const outside = action === 'removed' ? paths : paths.filter((path) => !path.startsWith(`${GSPOT_FOLDER}/`));
    const label = action.padEnd(CHANGE_LABEL_WIDTH);
    return [
        ...(gspotCount === 0 ? [] : [`${label}${formatCount(gspotCount, GENERATED_FILE_NOUN)} in ${GSPOT_FOLDER}/`]),
        ...outside.map((path) => `${label}${path}`),
    ];
}
