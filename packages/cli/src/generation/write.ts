import { dirname } from 'node:path';

import { BUNFIG_FILE, SCANNER_KEY } from '#cli/config/configurations/general.ts';
import {
    CHANGE_LABEL_WIDTH,
    GENERATED_FILE_NOUN,
    HOOKS_CHANGED_NOTE,
    MANAGED_KEYS_NOTE,
    STALE_LOCKFILE_NOTE,
    TOOL_PROJECT_FILES,
    TOOLS_CHANGED_NOTE,
} from '#cli/config/generation.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { GSPOT_FOLDER } from '#cli/config/parsers.ts';
import { EXECUTABLE_FILE } from '#cli/config/repository/files.ts';
import { INSTALLED_TOOL_FOLDERS, OWNER_WRITABLE_FILE, TEMPORARY_FILE_NAME } from '#cli/config/repository/setup.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { listOwnablePaths } from '#cli/generation/pointers.ts';
import { listExpectedPaths } from '#cli/generation/stale.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { isGspotPath } from '#cli/repository/files/classify.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { readHooks } from '#cli/repository/setup.ts';
import {
    listStrayPaths,
    planBlock,
    planManagedKeys,
    planRemovals,
    planReplacements,
    writePlans,
} from '#cli/repository/writer.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { deleteStaleTemporaryPaths } from '#cli/system/files/folders.ts';
import { findValueAt } from '#cli/system/tables.ts';
import { formatCount } from '#cli/system/text.ts';
import { installHooks } from '#cli/tools/installers/hooks.ts';
import { listStaleLockfiles } from '#cli/tools/installers/projects.ts';
import type { ApplyReport } from '#cli/types/generation.ts';
import type { FileContents, Files } from '#cli/types/system.ts';
import type { Generation, Session } from '#cli/types/tools.ts';

function deleteUnusedToolFolders(writer: Files, paths: ReadonlySet<string>): void {
    for (const [path, keep] of [
        [INSTALLED_TOOL_FOLDERS.npm, paths.has(GSPOT_PATHS.npmProject)],
        [INSTALLED_TOOL_FOLDERS.python, paths.has(GSPOT_PATHS.pythonProject)],
        [INSTALLED_TOOL_FOLDERS.vale, paths.has(GSPOT_PATHS.valeConfig)],
    ] as const) {
        if (!keep) writer.deleteTree(path);
    }
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

/**
List the generated files that a write changed: one line for the files in .gspot/ and one per file outside it, for each
kind of change. The files that stayed the same get no line.

@param report the applied file changes.
*/
export function listGeneratedChangeLines(report: ApplyReport): string[] {
    const lines: string[] = [];
    for (const [action, paths] of [
        ['wrote', report.written],
        ['updated', report.updated],
        ['removed', report.deleted],
    ] as const) {
        const gspotCount = paths.filter((path) => isGspotPath(path)).length;
        const label = action.padEnd(CHANGE_LABEL_WIDTH);
        if (gspotCount > 0) lines.push(`${label}${formatCount(gspotCount, GENERATED_FILE_NOUN)} in ${GSPOT_FOLDER}/`);
        lines.push(...paths.filter((path) => !isGspotPath(path)).map((path) => `${label}${path}`));
    }
    return lines;
}

/**
Format generated file changes and notes for command output.

@param report the applied file changes and notes.
*/
export function formatApplyReport(report: ApplyReport): string {
    const lines = listGeneratedChangeLines(report);
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
Plan, write, and report generated file changes. When the settings turn the hooks off, unset core.hooksPath at once, so
Git does not keep pointing at the removed hooks folder until the next install.

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
        deleted: [],
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
    report.deleted.push(...pruned.filter((plan) => plan.after === undefined).map(({ path }) => path));
    report.updated.push(...pruned.filter((plan) => plan.after !== undefined).map(({ path }) => path));
    const { hooksPath } = await readHooks(session.repository);
    if (!session.settings.hooks.enabled && hooksPath === GSPOT_PATHS.hooks) {
        const { note } = await installHooks(session, []);
        report.notes.push(note);
    }
    if (hasUnmanagedScanner(session, writer)) report.notes.push(MANAGED_KEYS_NOTE);
    return report;
}

/**
Write every generated file from the settings of a session. First delete the temporary files that an interrupted write
left in the folders of those files.

@param session the repository to write to.
@param writer writes and removes files.
*/
export async function writeEveryGeneratedFile(
    session: Session,
    writer: Files,
): Promise<{ generated: Generation; report: ApplyReport }> {
    const generated = buildGeneratedFiles(session);
    const folders = new Set(
        [...generated.files, ...generated.blocks, ...generated.managedKeys].map(({ path }) => dirname(path)),
    );
    for (const folder of folders) deleteStaleTemporaryPaths(writer, folder === '.' ? '' : folder, TEMPORARY_FILE_NAME);
    return { generated, report: await writeGeneratedFiles(session, generated, writer) };
}

/**
List the notes that ask for gspot install after a write: the tool lockfile is absent or stale, or the Git
hooks changed while Git runs other hooks.

@param session the repository that the files were written to.
@param generated the files that the write wrote.
@param report what the write changed.
*/
export async function listInstallNotes(
    session: Session,
    generated: Generation,
    report: ApplyReport,
): Promise<string[]> {
    const notes: string[] = [];
    const { hooksPath } = await readHooks(session.repository);
    if (
        session.settings.hooks.enabled &&
        hooksPath !== GSPOT_PATHS.hooks &&
        [...report.deleted, ...report.written].some((path) => path.startsWith(`${GSPOT_PATHS.hooks}/`))
    )
        notes.push(HOOKS_CHANGED_NOTE);
    if (listStaleLockfiles(session, generated.files).length === 0) return notes;
    const hasToolChanges = report.written.some((path) => TOOL_PROJECT_FILES.includes(path));
    return [...notes, hasToolChanges ? TOOLS_CHANGED_NOTE : STALE_LOCKFILE_NOTE];
}
