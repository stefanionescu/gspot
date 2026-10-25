import ignore from 'ignore';
import { compareText } from '#cli/system/text.ts';
import { join, posix, relative } from 'node:path';
import { hasErrorCode } from '#cli/system/errors.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import { readText } from '#cli/system/files/reads.ts';
import type { GitIndexFile } from '#cli/types/parsers/git.ts';
import { isIgnored } from '#cli/repository/files/gitignore.ts';
import { STATE_FOLDER_PATTERN } from '#cli/config/gspot-folder.ts';
import { buildGitError, runGitForBytes } from '#cli/system/git.ts';
import { decodeGitPaths, parseIndexFiles } from '#cli/parsers/git.ts';
import { statSync, lstatSync, readdirSync, realpathSync } from 'node:fs';
import { isInside, extractParentFolder, isInInstalledFolder } from '#cli/system/paths.ts';
import { GITLINK_MODE, GIT_FILE_MODES, EXECUTABLE_FILE } from '#cli/config/files/modes.ts';
import type { ListedFile, PathIgnore, PendingFolder, FolderListing } from '#cli/types/repository/files.ts';

import {
    GIT_FOLDER,
    GITIGNORE_FILE,
    EXECUTABLE_BITS,
    GIT_INDEX_FILES_ARGUMENTS,
    INSTALLED_DEPENDENCY_FOLDERS,
    GIT_UNTRACKED_FILES_ARGUMENTS,
} from '#cli/config/repository/files/tracked.ts';

function readSymlinkFile(root: string, path: string): ListedFile | undefined {
    const link = { path, size: 0, executable: false, symlink: true };
    let target: string;
    try {
        target = realpathSync(join(root, path));
    } catch (error) {
        if (hasErrorCode(error, 'ENOENT') || hasErrorCode(error, 'ELOOP')) return link;
        throw error;
    }
    if (!isInside(relative(realpathSync(root), target))) return undefined;
    const stat = statSync(target);
    return stat.isDirectory() ? undefined : { ...link, size: stat.size };
}

function readListedFile(
    root: string,
    path: string,
    executables: ReadonlySet<string> | undefined,
): ListedFile | undefined {
    const stat = lstatSync(join(root, path), { throwIfNoEntry: false });
    if (stat === undefined) return undefined;
    if (stat.isSymbolicLink()) {
        if (INSTALLED_DEPENDENCY_FOLDERS.has(posix.basename(path))) return undefined;
        return isInInstalledFolder(extractParentFolder(path))
            ? { path, size: stat.size, executable: false, symlink: true }
            : readSymlinkFile(root, path);
    }
    if (stat.isDirectory()) return undefined;
    const isExecutable = executables === undefined ? (stat.mode & EXECUTABLE_BITS) !== 0 : executables.has(path);
    return { path, size: stat.size, executable: isExecutable, symlink: false };
}

function readFolderListing(root: string, folder: string, inherited: PathIgnore[]): FolderListing {
    const children = readdirSync(join(root, folder), { withFileTypes: true });
    const ignores = [...inherited];
    if (children.some((child) => child.name === GITIGNORE_FILE && child.isFile())) {
        ignores.push({
            base: folder,
            matcher: ignore().add(readText(root, `${folder}${GITIGNORE_FILE}`)),
        });
    }
    return { children: children, ignores };
}

function walkPaths(root: string): string[] {
    const paths: string[] = [];
    const pending: PendingFolder[] = [{ folder: '', ignores: [] }];
    for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
        const { folder } = next;
        const { children, ignores } = readFolderListing(root, folder, next.ignores);
        const kept = children.filter((child) => {
            if (child.name === GIT_FOLDER) return false;
            const path = `${folder}${child.name}`;
            const listedPath = child.isDirectory() ? `${path}/` : path;
            return !isIgnored(listedPath, ignores) && !STATE_FOLDER_PATTERN.test(path.normalize('NFC'));
        });
        for (const child of kept) {
            const path = `${folder}${child.name}`;
            if (child.isDirectory()) pending.push({ folder: `${path}/`, ignores });
            else if (child.isFile() || child.isSymbolicLink()) paths.push(path);
        }
    }
    return paths;
}

async function listGitFiles(
    root: string,
    gitArguments: readonly string[],
    cancelSignal?: AbortSignal,
): Promise<string> {
    const listed = await runGitForBytes(root, gitArguments, { cancelSignal });
    if (listed.code !== 0) throw buildGitError(root, gitArguments, listed);
    return decodeGitPaths(listed.stdout);
}

/**
Read a Git index once for paths, executable bits, and gitlinks.

@param repositoryRoot the folder where Git runs.
@param cancelSignal stops the command.
@returns validated entries, retaining stages of conflicted working files.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 12 calls in 4 files share it.
export async function readIndexFiles(repositoryRoot: string, cancelSignal?: AbortSignal): Promise<GitIndexFile[]> {
    const listed = await listGitFiles(repositoryRoot, GIT_INDEX_FILES_ARGUMENTS, cancelSignal);
    return parseIndexFiles(listed);
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
List tracked and new files as sorted, root-relative paths. Outside Git, walk files according to the ignore rules.

@param repositoryRoot the folder where Git runs.
@param index the parsed staging area entries.
@param options what the walk knows about the repository.
@param options.hasGit whether the folder belongs to a Git repository.
@returns the entries with size, executable bit, and symlink flag.
*/
export async function listTrackedFiles(
    repositoryRoot: string,
    index: GitIndexFile[],
    { hasGit }: { hasGit: boolean },
): Promise<ListedFile[]> {
    const listed = hasGit ? await listGitFiles(repositoryRoot, GIT_UNTRACKED_FILES_ARGUMENTS) : undefined;
    const paths =
        listed === undefined
            ? walkPaths(repositoryRoot)
            : [...index.map((indexFile) => indexFile.path), ...listed.split('\0').filter(Boolean)];
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
        .filter(
            (path) =>
                !STATE_FOLDER_PATTERN.test(path.normalize('NFC')) &&
                submodules.every((module) => !isInScope(path, module)),
        )
        .toSorted((a, b) => compareText(a, b))
        .map((path) => readListedFile(repositoryRoot, path, executables))
        .filter((file) => file !== undefined);
}
