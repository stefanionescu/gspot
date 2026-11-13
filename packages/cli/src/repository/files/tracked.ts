import { lstatSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';

import { GIT_FILE_MODES, GITLINK_MODE } from '#cli/config/repository/files.ts';
import { EXECUTABLE_BITS, EXECUTABLE_FILE, INSTALLED_DEPENDENCY_FOLDERS } from '#cli/config/system.ts';
import { hasErrorCode } from '#cli/system/errors.ts';
import { findContainedPath } from '#cli/system/files/reads.ts';
import { extractParentFolder, isInInstalledFolder, isInScope } from '#cli/system/paths.ts';
import { compareText } from '#cli/system/text.ts';
import type { GitIndexFile, ListedFile, Repository } from '#cli/types/repository.ts';

function readSymlinkFile(root: string, path: string, { isTracked }: { isTracked: boolean }): ListedFile | undefined {
    const link = { path, size: 0, executable: false, isSymlink: true };
    let target: string | undefined;
    try {
        target = findContainedPath(root, path);
    } catch (error) {
        if (!hasErrorCode(error, 'ENOENT') && !hasErrorCode(error, 'ELOOP')) throw error;
        return isTracked ? link : undefined;
    }
    if (target === undefined) return undefined;
    const stat = statSync(target);
    return stat.isFile() ? { ...link, size: stat.size } : undefined;
}

function readListedFile(
    root: string,
    path: string,
    { executables, tracked }: { executables: ReadonlySet<string> | undefined; tracked: ReadonlySet<string> },
): ListedFile | undefined {
    const stat = lstatSync(join(root, path), { throwIfNoEntry: false });
    if (stat === undefined) return undefined;
    if (stat.isSymbolicLink()) {
        if (INSTALLED_DEPENDENCY_FOLDERS.has(posix.basename(path))) return undefined;
        return isInInstalledFolder(extractParentFolder(path))
            ? { path, size: stat.size, executable: false, isSymlink: true }
            : readSymlinkFile(root, path, { isTracked: tracked.has(path) });
    }
    if (!stat.isFile()) return undefined;
    const isExecutable = executables === undefined ? (stat.mode & EXECUTABLE_BITS) !== 0 : executables.has(path);
    return { path, size: stat.size, executable: isExecutable, isSymlink: false };
}

export function listSubmodulePaths(indexFiles: GitIndexFile[]): string[] {
    return [
        ...new Set(
            indexFiles.filter((indexFile) => indexFile.mode === GITLINK_MODE).map((indexFile) => indexFile.path),
        ),
    ].toSorted((left, right) => compareText(left, right));
}

export function listTrackedFiles(root: string, index: GitIndexFile[], untracked: string[]): ListedFile[] {
    const tracked = new Set(index.map((indexFile) => indexFile.path));
    const paths = [...tracked, ...untracked];
    const submodules = listSubmodulePaths(index);
    const executables =
        process.platform === 'win32'
            ? new Set(
                  index
                      .filter(
                          (indexFile) =>
                              indexFile.mode !== GITLINK_MODE && GIT_FILE_MODES[indexFile.mode] === EXECUTABLE_FILE,
                      )
                      .map((indexFile) => indexFile.path),
              )
            : undefined;
    return [...new Set(paths)]
        .filter((path) => submodules.every((module) => !isInScope(path, module)))
        .toSorted((a, b) => compareText(a, b))
        .map((path) => readListedFile(root, path, { executables, tracked }))
        .filter((file) => file !== undefined);
}

/**
List the paths of the index, or of the listed files when the index is empty.
*/
export function listTrackedPaths(repository: Pick<Repository, 'index' | 'files'>): string[] {
    return (repository.index.length === 0 ? repository.files : repository.index).map(({ path }) => path);
}
