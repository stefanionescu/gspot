import { join, posix, dirname } from 'node:path';
import { setImmediate } from 'node:timers/promises';
import type { Session } from '#cli/types/session.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { DOT_GSPOT } from '#cli/config/gspot-folder.ts';
import { NODE_MODULES } from '#cli/config/files/names.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { splitSystemPath } from '#cli/system/files/names.ts';
import { normalizeFileMode } from '#cli/system/files/entries.ts';
import { copyDependencies } from '#cli/runs/copy/dependencies.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { type Files, type TemporaryFolder } from '#cli/types/system/files.ts';
import { listWorkspaceDependencySources } from '#cli/repository/npm/workspaces.ts';
import { SYMLINK_MODE, PERMISSION_BITS, ENTRY_FILE_MODES } from '#cli/config/files/modes.ts';
import type { CopyFile, CopyPlan, CopyPaths, DependencyCopy } from '#cli/types/runs/copy.ts';
import { COPY_ROOT_FILES, DEPENDENCY_FILES, FILES_BETWEEN_PAUSES } from '#cli/config/runs/copy/files.ts';
import { statSync, chmodSync, constants, mkdirSync, symlinkSync, copyFileSync, writeFileSync } from 'node:fs';

// Source reads go through the confined reader, so they stay inside the repository.
function writeCopyFile(files: Files, copyRoot: string, file: CopyFile): void {
    const target = join(copyRoot, ...splitSystemPath(typeof file === 'string' ? file : file.entry.path));
    mkdirSync(dirname(target), { recursive: true });
    if (typeof file === 'string') {
        const source = files.readRealPath(file);
        copyFileSync(source, target, constants.COPYFILE_FICLONE);
        chmodSync(target, statSync(source).mode & PERMISSION_BITS);
        return;
    }
    const mode = normalizeFileMode({ mode: ENTRY_FILE_MODES[file.entry.mode] });
    if (file.entry.mode === SYMLINK_MODE) symlinkSync(file.bytes, target);
    else {
        writeFileSync(target, file.bytes, { flag: 'wx', mode });
        chmodSync(target, mode);
    }
}

/**
 * Writes files and Git blobs into a copy.
 *
 * @param plan what to write, and where.
 */
export async function writeCopyFiles(plan: CopyPlan): Promise<void> {
    using files = openFiles(plan.root);
    let written = 0;
    for await (const file of plan.files) {
        if (written % FILES_BETWEEN_PAUSES === 0) await setImmediate();
        written += 1;
        plan.cancelSignal?.throwIfAborted();
        const path = typeof file === 'string' ? file : file.entry.path;
        if (!plan.dependencies.some((dependency) => isInScope(path, dependency.path)))
            writeCopyFile(files, plan.target, file);
    }
}

/**
 * Copies the files and dependency trees that the check needs.
 *
 * @param session the repository and its tools.
 * @param planned the check and its files.
 * @param extra more paths to copy.
 * @returns the new folder, deleted on dispose.
 */
export async function createCheckCopy(
    session: Session,
    planned: PlannedCheck,
    extra: string[] = [],
): Promise<TemporaryFolder> {
    return createCopy({
        ...selectCopyPaths(
            session.root,
            [
                ...planned.files.map((file) => file.path),
                ...listWorkspaceDependencySources(session.reads, planned.scope.folder.path, session.repository.files),
                ...extra,
            ],
            session.repository.scopeFolders.map((scope) => scope.path),
        ),
        cancelSignal: session.cancelSignal,
    });
}

/**
 * Copies source files and dependency trees into a new copy.
 *
 * @param source the paths and dependency trees to copy.
 * @returns the new folder, deleted on dispose.
 */
export async function createCopy(source: CopyPaths): Promise<TemporaryFolder> {
    const folder = createTemporaryFolder();
    try {
        const input = {
            ...source,
            target: folder.path,
            files: new Set(source.paths),
        };
        await writeCopyFiles(input);
        await copyDependencies(input);
        return folder;
    } catch (error) {
        folder[Symbol.dispose]();
        throw error;
    }
}

/**
 * Selects the paths and installed dependency trees for a copy of the working tree.
 *
 * @param repositoryRoot the repository folder.
 * @param paths the tracked files to copy.
 * @param scopes the folders that hold installed dependencies.
 * @returns the paths and dependency trees to copy.
 */
export function selectCopyPaths(repositoryRoot: string, paths: string[], scopes: string[]): CopyPaths {
    const projects = paths.flatMap((path) =>
        DEPENDENCY_FILES.has(posix.basename(path)) && posix.basename(posix.dirname(path)) !== DOT_GSPOT
            ? [posix.dirname(path)]
            : [],
    );
    const dependencies = [
        ...new Set([DOT_GSPOT, ...scopes, ...projects].map((project) => posix.join(project, NODE_MODULES))),
    ]
        .filter((path) => statSync(join(repositoryRoot, path), { throwIfNoEntry: false }) !== undefined)
        .map(
            (path): DependencyCopy => ({
                path,
                operation: path === posix.join(DOT_GSPOT, NODE_MODULES) ? 'link' : 'clone',
            }),
        );
    return {
        root: repositoryRoot,
        paths: [...new Set([...paths, ...COPY_ROOT_FILES])].filter(
            (path) => statSync(join(repositoryRoot, path), { throwIfNoEntry: false }) !== undefined,
        ),
        dependencies,
    };
}
