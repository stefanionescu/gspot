import { dirname } from 'node:path';

import {
    CHANGE_LABEL_WIDTH,
    HOOKS_CHANGED_NOTE,
    STALE_LOCKFILE_NOTE,
    TOOL_PROJECT_FILES,
    TOOLS_CHANGED_NOTE,
} from '#cli/config/generation/files.ts';
import { GENERATED_FILE_NOUN } from '#cli/config/generation/setup.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { INSTALLED_TOOL_FOLDERS, TEMPORARY_FILE_NAME } from '#cli/config/repository/setup.ts';
import { EXECUTABLE_FILE, GSPOT_FOLDER, OWNER_WRITABLE_FILE } from '#cli/config/system.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { listOwnablePaths } from '#cli/generation/pointers.ts';
import { isGspotPath } from '#cli/repository/files/classify.ts';
import { readHooks } from '#cli/repository/setup.ts';
import {
    listStrayPaths,
    planBlock,
    planManagedKeys,
    planRemovals,
    planReplacements,
    writePlans,
} from '#cli/repository/writer.ts';
import { deleteStaleTemporaryPaths } from '#cli/system/files/temporary.ts';
import { formatCount } from '#cli/system/text/messages.ts';
import { installHooks } from '#cli/tools/installers/hooks.ts';
import { selectLockfileName } from '#cli/tools/installers/npm/lockfiles.ts';
import { listStaleLockfiles } from '#cli/tools/installers/projects.ts';
import type { ApplyReport, GeneratedWritePlans } from '#cli/types/generation.ts';
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

function listExpectedPaths(session: Pick<Session, 'toolPackageManager'>, generated: Generation): Set<string> {
    const paths = new Set([...generated.files, ...generated.blocks, ...generated.managedKeys].map((file) => file.path));
    const { toolPackageManager } = session;
    const project = generated.files.find((file) => file.path === GSPOT_PATHS.npmProject);
    if (toolPackageManager !== undefined && project !== undefined)
        paths.add(`${GSPOT_FOLDER}/${selectLockfileName(toolPackageManager)}`);
    for (const file of generated.files) {
        if (file.path === GSPOT_PATHS.miseProject) paths.add(GSPOT_PATHS.miseLockfile);
        else if (file.path === GSPOT_PATHS.pythonProject) paths.add(GSPOT_PATHS.uvLockfile);
    }
    return paths;
}

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

export function formatApplyReport(report: ApplyReport): string {
    const lines = listGeneratedChangeLines(report);
    if (lines.length === 0) lines.push('Generated files: none changed.');
    lines.push(...report.notes.map((note) => `note     ${note}`));
    return `${lines.join('\n')}\n`;
}

/**
Plan every write that brings the generated files up to date, and write none. The stale check and the install read this
one plan, so the check reports what the install changes. `reviewed` holds the contents that the user saw before agreeing
to a replacement.
*/
export function planGeneratedWrites(
    session: Session,
    generated: Generation,
    writer: Files,
    reviewed?: ReadonlyMap<string, FileContents | undefined>,
): GeneratedWritePlans {
    const expected = listExpectedPaths(session, generated);
    return {
        replacements: planReplacements(
            writer,
            generated.files.map((file) => ({
                path: file.path,
                next: {
                    bytes: Buffer.from(file.content),
                    mode: file.executable === true ? EXECUTABLE_FILE : OWNER_WRITABLE_FILE,
                },
                previous: reviewed?.get(file.path),
            })),
        ),
        managedKeys: generated.managedKeys.map((output) => planManagedKeys(writer, output.path, output.keys)),
        blocks: generated.blocks.map((block) => planBlock(writer, block.path, block.body)),
        removals: planRemovals(writer, listStrayPaths(session, expected, listOwnablePaths(session))),
    };
}

/**
Plan, write, and report generated file changes. When the settings turn the hooks off, unset core.hooksPath at once, so
Git does not keep pointing at the removed hooks folder until the next install.
*/
export async function writeGeneratedFiles(
    session: Session,
    generated: Generation,
    writer: Files,
    options?: { reviewed?: ReadonlyMap<string, FileContents | undefined> | undefined },
): Promise<ApplyReport> {
    const report: ApplyReport = {
        written: [],
        unchanged: [],
        deleted: [],
        updated: [],
        notes: [],
    };
    const { replacements, managedKeys, blocks, removals } = planGeneratedWrites(
        session,
        generated,
        writer,
        options?.reviewed,
    );
    writePlans(writer, [...replacements, ...managedKeys, ...blocks, ...removals]);
    deleteUnusedToolFolders(writer, listExpectedPaths(session, generated));
    report.written.push(...replacements.filter((plan) => plan.status === 'changed').map((plan) => plan.path));
    report.unchanged.push(...replacements.filter((plan) => plan.status === 'unchanged').map((plan) => plan.path));
    report.updated.push(
        ...[...blocks, ...managedKeys].filter((plan) => plan.status === 'changed').map((plan) => plan.path),
    );
    const pruned = removals.filter((plan) => plan.status === 'changed');
    report.deleted.push(...pruned.filter((plan) => plan.after === undefined).map(({ path }) => path));
    report.updated.push(...pruned.filter((plan) => plan.after !== undefined).map(({ path }) => path));
    const { hooksPath } = await readHooks(session.repository);
    if (!session.settings.hooks.enabled && hooksPath === GSPOT_PATHS.hooks) {
        const { note } = await installHooks(session, []);
        report.notes.push(note);
    }
    return report;
}

export async function writeEveryGeneratedFile(session: Session, writer: Files): Promise<ApplyReport> {
    const generated = buildGeneratedFiles(session);
    const folders = new Set(
        [...generated.files, ...generated.blocks, ...generated.managedKeys].map(({ path }) => dirname(path)),
    );
    for (const folder of folders) deleteStaleTemporaryPaths(writer, folder === '.' ? '' : folder, TEMPORARY_FILE_NAME);
    return writeGeneratedFiles(session, generated, writer);
}

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
