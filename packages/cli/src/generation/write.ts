import { formatCount } from '#cli/system/text.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { GspotError } from '#cli/system/errors.ts';
import { findValueAt } from '#cli/system/tables.ts';
import { readHooks } from '#cli/repository/setup.ts';
import type { Session } from '#cli/types/session.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { writeSettings } from '#cli/settings/file.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { openSession } from '#cli/planning/session.ts';
import { listOwnablePaths } from '#cli/generation/links.ts';
import { buildEditedSettings } from '#cli/settings/edit.ts';
import type { CommandResult } from '#cli/types/terminal.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { listExpectedPaths } from '#cli/generation/outdated.ts';
import { SETTINGS_FILE } from '#cli/config/settings/settings.ts';
import { listStaleLockfiles } from '#cli/installers/projects.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import type { Files, FileContents } from '#cli/types/system/files.ts';
import type { SettingsEditOptions } from '#cli/types/generation/generation.ts';
import { EXECUTABLE_FILE, OWNER_WRITABLE_FILE } from '#cli/config/files/modes.ts';
import { type Generation, type ApplyReport } from '#cli/types/generation/files.ts';
import { SCANNER_KEY, BUNFIG_FILE } from '#cli/config/generation/configurations/general.ts';
import { GSPOT_PATHS, GSPOT_FOLDER, INSTALLED_TOOL_FOLDERS } from '#cli/config/files/gspot.ts';

import {
    planBlock,
    writePlans,
    planRemovals,
    listStrayPaths,
    planManagedKeys,
    planReplacements,
} from '#cli/repository/writer.ts';
import {
    FIX_APPLY_MESSAGE,
    MANAGED_KEYS_NOTE,
    CHANGE_LABEL_WIDTH,
    TOOL_PROJECT_FILES,
    HOOKS_CHANGED_NOTE,
    TOOLS_CHANGED_NOTE,
    GENERATED_FILE_NOUN,
    STALE_LOCKFILE_NOTE,
} from '#cli/config/generation/generation.ts';

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
            findValueAt(parseTomlFile(path, previous.bytes.toString('utf8')), SCANNER_KEY) !== undefined
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

/**
Edit settings, check them, and write them and their generated files. Installs nothing.

@param root the folder where gspot writes settings and generated files.
@param options the edit and the text the report adds.
*/
export async function writeSettingsEdit(
    root: string,
    options: SettingsEditOptions,
): Promise<CommandResult<ApplyReport & { changed: boolean; summary: string }>> {
    const { edit, summary } = options;
    const writer = openFiles(root);
    const result = buildEditedSettings(root, edit);
    options.cache?.sources.set(SETTINGS_FILE, Buffer.from(result.text));
    const session = await openSession(root, {
        cache: options.cache,
        listing: options.listing,
        settingsFile: { settings: result.settings, text: result.text },
    });
    const generated = buildGeneratedFiles(session);
    writeSettings(writer, result.text, edit.previous);
    let report: ApplyReport;
    try {
        report = await writeGeneratedFiles(session, generated, writer);
    } catch (error) {
        if (!(error instanceof GspotError)) throw error;
        throw new GspotError(
            'writing',
            [
                summary,
                `gspot.toml keeps this change, and applying it stopped: ${error.message}`,
                FIX_APPLY_MESSAGE,
            ].join('\n'),
            { cause: error },
        );
    }
    report.notes.push(...(options.notes ?? []));
    const written = report.written.length + report.updated.length + report.removed.length;
    const unchanged = written === 0 ? 'No change: gspot.toml already says this.' : 'gspot.toml already says this.';
    const shown = result.changed ? summary : unchanged;
    return {
        text: `${shown}\n${formatApplyReport(report)}`,
        json: { ...report, summary: shown, changed: result.changed },
        exitCode: 0,
    };
}
