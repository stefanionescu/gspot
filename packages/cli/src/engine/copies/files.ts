import { join, posix, dirname } from 'node:path';
import type { Session } from '#cli/types/tools.ts';
import { setImmediate } from 'node:timers/promises';
import { hasErrorCode } from '#cli/system/errors.ts';
import { GSPOT_FOLDER } from '#cli/config/parsers.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { splitSystemPath } from '#cli/system/files/reads.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { createCopyFolder } from '#cli/engine/copies/folders.ts';
import { normalizeFileMode } from '#cli/system/files/bounded.ts';
import type { Files, TemporaryFolder } from '#cli/types/system.ts';
import { NODE_MODULES, PERMISSION_BITS } from '#cli/config/system.ts';
import { copyDependencies } from '#cli/engine/copies/dependencies.ts';
import { SYMLINK_MODE, GIT_FILE_MODES } from '#cli/config/repository/files.ts';
import { listWorkspaceSources } from '#cli/repository/javascript/workspaces.ts';
import type { CopyFile, CopyPlan, CopyPaths } from '#cli/types/engine/tool-runs.ts';
import { COPY_ROOT_FILES, DEPENDENCY_FILES, FILES_BETWEEN_PAUSES } from '#cli/config/engine.ts';
import { statSync, chmodSync, constants, mkdirSync, symlinkSync, copyFileSync, writeFileSync } from 'node:fs';

function writeCopyLink(target: string, destination: Buffer, mode: number): void {
    try {
        symlinkSync(destination, target);
    } catch (error) {
        if (process.platform !== 'win32' || !hasErrorCode(error, 'EPERM')) throw error;
        writeFileSync(target, destination, { flag: 'wx', mode });
    }
}

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
    if (file.indexFile.mode === SYMLINK_MODE) writeCopyLink(target, file.bytes, mode);
    else {
        writeFileSync(target, file.bytes, { flag: 'wx', mode });
        chmodSync(target, mode);
    }
}

/**
Selects the paths and installed dependency trees for a copy of the working tree.

@param root the repository folder.
@param paths the tracked files to copy.
@param scopes the folders that hold installed dependencies.
*/
function selectCopyPaths(root: string, paths: string[], scopes: string[]): CopyPaths {
    const projects = paths.flatMap((path) =>
        DEPENDENCY_FILES.has(posix.basename(path)) && posix.basename(posix.dirname(path)) !== GSPOT_FOLDER
            ? [posix.dirname(path)]
            : [],
    );
    const dependencies = [
        ...new Set([GSPOT_FOLDER, ...scopes, ...projects].map((project) => posix.join(project, NODE_MODULES))),
    ].filter((path) => statSync(join(root, path), { throwIfNoEntry: false }) !== undefined);
    return {
        paths: [...new Set([...paths, ...COPY_ROOT_FILES])].filter(
            (path) => statSync(join(root, path), { throwIfNoEntry: false }) !== undefined,
        ),
        dependencies,
    };
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
    const { paths, dependencies } = selectCopyPaths(
        session.root,
        [
            ...planned.files.map((file) => file.path),
            ...listWorkspaceSources(session.cache, planned.scope.path, session.repository.files),
            ...includedPaths,
        ],
        session.repository.scopeFolders.map((scope) => scope.path),
    );
    return createCopy(session, paths, dependencies);
}

/**
Copies source files and dependency trees into a private folder inside the repository. Linked packages share the
repository root with the copy, so Astro resolves their paths outside the copied source tree.

@param session the repository and its cancel signal.
@param paths the files to copy.
@param dependencies the installed dependency trees to link.
@returns the new folder, deleted on dispose.
*/
export async function createCopy(
    session: Pick<Session, 'root' | 'cancelSignal'>,
    paths: string[],
    dependencies: string[] = [],
): Promise<TemporaryFolder> {
    const folder = createCopyFolder(session.root);
    try {
        const plan = {
            root: session.root,
            target: folder.path,
            files: new Set(paths),
            dependencies,
            cancelSignal: session.cancelSignal,
        };
        await writeCopyFiles(plan);
        await copyDependencies(plan);
        return folder;
    } catch (error) {
        folder[Symbol.dispose]();
        throw error;
    }
}
