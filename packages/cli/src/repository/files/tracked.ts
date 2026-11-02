import { join, posix } from 'node:path';
import { statSync, lstatSync } from 'node:fs';
import { compareText } from '#cli/system/text.ts';
import { hasErrorCode } from '#cli/system/errors.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import { decodeGitPaths } from '#cli/repository/git/output.ts';
import { findContainedPath } from '#cli/system/files/reads.ts';
import { INSTALLED_DEPENDENCY_FOLDERS } from '#cli/config/system.ts';
import { runGitBytes, buildGitError } from '#cli/repository/git/run.ts';
import type { ListedFile, GitIndexFile } from '#cli/types/repository.ts';
import { extractParentFolder, isInInstalledFolder } from '#cli/system/paths.ts';
import { GITLINK_MODE, GIT_FILE_MODES, EXECUTABLE_FILE, EXECUTABLE_BITS } from '#cli/config/repository/files.ts';

function readSymlinkFile(root: string, path: string, isTracked: boolean): ListedFile | undefined {
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
            : readSymlinkFile(root, path, tracked.has(path));
    }
    if (!stat.isFile()) return undefined;
    const isExecutable = executables === undefined ? (stat.mode & EXECUTABLE_BITS) !== 0 : executables.has(path);
    return { path, size: stat.size, executable: isExecutable, isSymlink: false };
}

/**
Read a Git file listing and separate names with invalid UTF-8.

@param root the folder where Git runs.
@param gitArguments the listing command and flags.
@param cancelSignal stops the command.
@param unreadablePaths receives quoted names with invalid UTF-8.
@returns the readable null-delimited listing.
*/
export async function readGitListing(
    root: string,
    gitArguments: readonly string[],
    cancelSignal: AbortSignal | undefined,
    unreadablePaths: string[],
): Promise<string> {
    const listed = await runGitBytes(root, gitArguments, { cancelSignal });
    if (listed.code !== 0) throw buildGitError(root, gitArguments, listed);
    return decodeGitPaths(listed.stdout, unreadablePaths);
}

/**
Find gitlinks without opening submodule folders or reading their settings.

@param indexFiles the shared index listing.
@returns sorted, unique submodule paths.
*/
export function listSubmodulePaths(indexFiles: GitIndexFile[]): string[] {
    return [
        ...new Set(
            indexFiles.filter((indexFile) => indexFile.mode === GITLINK_MODE).map((indexFile) => indexFile.path),
        ),
    ].toSorted((left, right) => compareText(left, right));
}

/**
List tracked and new files as sorted, root-relative paths.

@param root the folder where Git runs.
@param index the parsed staging area entries.
@param untracked the null-delimited listing of the untracked files.
*/
export function listTrackedFiles(root: string, index: GitIndexFile[], untracked: string): ListedFile[] {
    const tracked = new Set(index.map((indexFile) => indexFile.path));
    const paths = [...tracked, ...untracked.split('\0').filter(Boolean)];
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
