import { lstatSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { isInScope } from '#cli/repository/scopes.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { readHooks } from '#cli/repository/setup/read.ts';
import type { Repository } from '#cli/types/repository.ts';
import { installHooks } from '#cli/tools/installers/hooks.ts';
import type { Session, Generation } from '#cli/types/tools.ts';
import { VALE_TEMPORARY_NAME } from '#cli/config/tools/vale.ts';
import type { Files, FileContents } from '#cli/types/system.ts';
import { GITIGNORE_FILE } from '#cli/config/repository/files.ts';
import { openFiles, walkFiles } from '#cli/system/files/open.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { isGspotOwned } from '#cli/repository/files/ownership.ts';
import { listOwnablePaths } from '#cli/generation/configs/paths.ts';
import { findBlockSpan } from '#cli/parsers/formats/managed-blocks.ts';
import { deleteStaleTemporaryPaths } from '#cli/system/files/temporary.ts';
import { selectLockfileName } from '#cli/tools/installers/npm/lockfiles.ts';
import { readGspotGeneratedPatterns } from '#cli/repository/git/attributes.ts';
import { AGENTS_FILE, GITATTRIBUTES_FILE } from '#cli/config/parsers/formats.ts';
import type { ApplyReport, GeneratedWritePlans } from '#cli/types/generation.ts';
import { GSPOT_FOLDER, EXECUTABLE_FILE, OWNER_WRITABLE_FILE } from '#cli/config/system.ts';
import { TEMPORARY_FILE_NAME, LEADING_PATH_SEGMENTS, INSTALLED_TOOL_FOLDERS } from '#cli/config/generation/files.ts';

import {
    planBlock,
    writePlans,
    planRemovals,
    planManagedKeys,
    planReplacements,
} from '#cli/repository/files/writes.ts';

function isTemporaryPath(path: string): boolean {
    if (TEMPORARY_FILE_NAME.test(basename(path))) return true;
    const [folder, name] = path.split('/', LEADING_PATH_SEGMENTS);
    return folder === GSPOT_FOLDER && name !== undefined && VALE_TEMPORARY_NAME.test(name);
}

function listStrayPaths(
    session: { root: string; repository: Repository },
    expected: ReadonlySet<string>,
    ownablePaths: ReadonlySet<string>,
): string[] {
    const disk = openFiles(session.root);
    const blockPaths = new Set([AGENTS_FILE, GITIGNORE_FILE, GITATTRIBUTES_FILE]);
    const installations = Object.values(INSTALLED_TOOL_FOLDERS);
    const ownPaths: string[] = [];
    walkFiles(disk, GSPOT_FOLDER, (path) => {
        if (isTemporaryPath(path) || installations.some((folder) => isInScope(path, folder))) return false;
        if (lstatSync(join(session.root, path)).isDirectory()) return true;
        ownPaths.push(path);
        return false;
    });
    const generatedPatterns = readGspotGeneratedPatterns(disk);
    const writtenPaths = new Set([
        ...ownPaths,
        ...session.repository.files.filter(({ kind }) => kind === 'generated').map(({ path }) => path),
        ...blockPaths,
    ]);
    return [...writtenPaths].filter((path) => {
        if (isTemporaryPath(path) || installations.some((folder) => isInScope(path, folder)) || expected.has(path))
            return false;
        if (isGspotOwned(path, disk, generatedPatterns, ownablePaths)) return true;
        if (!blockPaths.has(path)) return false;
        const text = disk.read(path)?.bytes.toString('utf8');
        return text !== undefined && findBlockSpan(text, path) !== undefined;
    });
}

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
