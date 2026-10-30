import { join, posix, dirname } from 'node:path';
import { setImmediate } from 'node:timers/promises';
import type { Session } from '#cli/types/session.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { GSPOT_FOLDER } from '#cli/config/files/gspot.ts';
import { NODE_MODULES } from '#cli/config/files/names.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { splitSystemPath } from '#cli/system/files/names.ts';
import { normalizeFileMode } from '#cli/system/files/bounded.ts';
import { copyDependencies } from '#cli/runs/copy/dependencies.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { listWorkspaceSources } from '#cli/repository/npm/workspaces.ts';
import type { CopyFile, CopyPlan, CopyPaths } from '#cli/types/runs/copy.ts';
import { type Files, type TemporaryFolder } from '#cli/types/system/files.ts';
import { SYMLINK_MODE, GIT_FILE_MODES, PERMISSION_BITS } from '#cli/config/files/modes.ts';
import { COPY_ROOT_FILES, DEPENDENCY_FILES, FILES_BETWEEN_PAUSES } from '#cli/config/runs/copy/files.ts';
import { statSync, chmodSync, constants, mkdirSync, symlinkSync, copyFileSync, writeFileSync } from 'node:fs';

function writeCopyFile(files: Files, copyRoot: string, file: CopyFile): void {
    const target = join(copyRoot, ...splitSystemPath(typeof file === 'string' ? file : file.indexFile.path));
    mkdirSync(dirname(target), { recursive: true });
    if (typeof file === 'string') {
        const source = files.readCanonicalPath(file);
        copyFileSync(source, target, constants.COPYFILE_FICLONE);
        chmodSync(target, statSync(source).mode & PERMISSION_BITS);
        return;
    }
    const mode = normalizeFileMode({ mode: GIT_FILE_MODES[file.indexFile.mode] });
    if (file.indexFile.mode === SYMLINK_MODE) symlinkSync(file.bytes, target);
    else {
        writeFileSync(target, file.bytes, { flag: 'wx', mode });
        chmodSync(target, mode);
    }
}

/**
Writes files and Git blobs into a copy.

@param plan what to write, and where.
*/
export async function writeCopyFiles(plan: CopyPlan): Promise<void> {
    const files = openFiles(plan.root);
    let written = 0;
    for await (const file of plan.files) {
        if (written % FILES_BETWEEN_PAUSES === 0) await setImmediate();
        written += 1;
        plan.cancelSignal?.throwIfAborted();
        const path = typeof file === 'string' ? file : file.indexFile.path;
        if (plan.dependencies.every((dependency) => !isInScope(path, dependency)))
            writeCopyFile(files, plan.target, file);
    }
}

/**
Copies the files and dependency trees that the check needs.

@param session the repository and its tools.
@param planned the check and its files.
@param includedPaths more paths to copy.
@returns the new folder, deleted on dispose.
*/
export async function createCheckCopy(
    session: Session,
    planned: PlannedCheck,
    includedPaths: string[] = [],
): Promise<TemporaryFolder> {
    return createCopy({
        ...selectCopyPaths(
            session.root,
            [
                ...planned.files.map((file) => file.path),
                ...listWorkspaceSources(session.cache, planned.scope.path, session.repository.files),
                ...includedPaths,
            ],
            session.repository.scopeFolders.map((scope) => scope.path),
        ),
        cancelSignal: session.cancelSignal,
    });
}

/**
Copies source files and dependency trees into a new copy.

@param source the paths and dependency trees to copy.
@returns the new folder, deleted on dispose.
*/
export async function createCopy(source: CopyPaths): Promise<TemporaryFolder> {
    using cleanup = new DisposableStack();
    const folder = cleanup.use(createTemporaryFolder());
    const plan = {
        ...source,
        target: folder.path,
        files: new Set(source.paths),
    };
    await writeCopyFiles(plan);
    await copyDependencies(plan);
    cleanup.move();
    return folder;
}

/**
Selects the paths and installed dependency trees for a copy of the working tree.

@param root the repository folder.
@param paths the tracked files to copy.
@param scopes the folders that hold installed dependencies.
*/
export function selectCopyPaths(root: string, paths: string[], scopes: string[]): CopyPaths {
    const projects = paths.flatMap((path) =>
        DEPENDENCY_FILES.has(posix.basename(path)) && posix.basename(posix.dirname(path)) !== GSPOT_FOLDER
            ? [posix.dirname(path)]
            : [],
    );
    const dependencies = [
        ...new Set([GSPOT_FOLDER, ...scopes, ...projects].map((project) => posix.join(project, NODE_MODULES))),
    ].filter((path) => statSync(join(root, path), { throwIfNoEntry: false }) !== undefined);
    return {
        root: root,
        paths: [...new Set([...paths, ...COPY_ROOT_FILES])].filter(
            (path) => statSync(join(root, path), { throwIfNoEntry: false }) !== undefined,
        ),
        dependencies,
    };
}
