import ignore from 'ignore';
import { isInside } from '#cli/system/paths.ts';
import { join, posix, relative } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import { runGitForBytes } from '#cli/system/git.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import { parseIndexEntries } from '#cli/parsers/git.ts';
import { isIgnored } from '#cli/repository/files/gitignore.ts';
import type { GitIndexEntry } from '#cli/types/parsers/git.ts';
import { STATE_FOLDER_PATTERN } from '#cli/config/gspot-paths.ts';
import { readText, decodeUtf8 } from '#cli/system/files/reads.ts';
import { statSync, lstatSync, readdirSync, realpathSync } from 'node:fs';
import { GITLINK_MODE, ENTRY_FILE_MODES } from '#cli/config/parsers/git.ts';
import { EXECUTABLE_BITS, EXECUTABLE_FILE } from '#cli/config/system/modes.ts';
import type { ListedFile, PathIgnore, PendingFolder, FolderListing } from '#cli/types/repository/inventory.ts';

import {
    GIT_FOLDER,
    GITIGNORE_FILE,
    GIT_INDEX_FILES_ARGUMENTS,
    INSTALLED_DEPENDENCY_FOLDERS,
    GIT_UNTRACKED_FILES_ARGUMENTS,
} from '#cli/config/repository/tracked.ts';

// A link to a folder, or one that leaves the repository, stays out of the inventory, so checks cannot read past it. A dangling link remains
// listed with no size.
function readSymlinkFile(root: string, path: string): ListedFile | undefined {
    const link = { path, size: 0, executable: false, symlink: true };
    let target: string;
    try {
        target = realpathSync(join(root, path));
    } catch (error) {
        if (error instanceof Error && 'code' in error && (error.code === 'ENOENT' || error.code === 'ELOOP'))
            return link;
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
        // Inventory installed links without reading their dependency targets outside this root.
        if (
            path
                .split('/')
                .slice(0, -1)
                .some((part) => INSTALLED_DEPENDENCY_FOLDERS.has(part))
        )
            return { path, size: stat.size, executable: false, symlink: true };
        return readSymlinkFile(root, path);
    }
    if (stat.isDirectory()) return undefined;
    const isExecutable = executables === undefined ? (stat.mode & EXECUTABLE_BITS) !== 0 : executables.has(path);
    return { path, size: stat.size, executable: isExecutable, symlink: false };
}

function readFolderListing(root: string, folder: string, inherited: PathIgnore[]): FolderListing {
    const entries = readdirSync(join(root, folder), { withFileTypes: true });
    const ignores = [...inherited];
    if (entries.some((entry) => entry.name === GITIGNORE_FILE && entry.isFile())) {
        ignores.push({
            base: folder,
            matcher: ignore().add(readText(root, `${folder}${GITIGNORE_FILE}`)),
        });
    }
    return { entries, ignores };
}

function walkPaths(root: string): string[] {
    const paths: string[] = [];
    const pending: PendingFolder[] = [{ folder: '', ignores: [] }];
    for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
        const { folder } = next;
        const { entries, ignores } = readFolderListing(root, folder, next.ignores);
        const retained = entries.filter((entry) => {
            if (entry.name === GIT_FOLDER) return false;
            const path = `${folder}${entry.name}`;
            const candidate = entry.isDirectory() ? `${path}/` : path;
            return !isIgnored(candidate, ignores) && !STATE_FOLDER_PATTERN.test(path.normalize('NFC'));
        });
        for (const entry of retained) {
            const path = `${folder}${entry.name}`;
            if (entry.isDirectory()) pending.push({ folder: `${path}/`, ignores });
            else if (entry.isFile() || entry.isSymbolicLink()) paths.push(path);
        }
    }
    return paths;
}

// Share Git listing failure classification while each caller owns its output format and non-Git behavior.
async function listGitFiles(
    root: string,
    gitArguments: readonly string[],
    cancelSignal?: AbortSignal,
): Promise<string> {
    const listed = await runGitForBytes(root, gitArguments, { cancelSignal });
    if (listed.code === 0) {
        const text = decodeUtf8(listed.stdout);
        if (text === undefined) throw new GspotError('git', 'Revision paths must be valid UTF-8.');
        return text;
    }
    throw new GspotError(
        'git',
        `Git ls-files failed in ${root} (exit ${String(listed.code)}): ${listed.stderr.trim()}`,
    );
}

/**
 * Read a Git index once for paths, executable bits, and gitlinks.
 *
 * @param repositoryRoot the folder where Git runs.
 * @param cancelSignal stops the command.
 * @returns validated entries, retaining stages of conflicted working files.
 */
export async function readIndexEntries(repositoryRoot: string, cancelSignal?: AbortSignal): Promise<GitIndexEntry[]> {
    const listed = await listGitFiles(repositoryRoot, GIT_INDEX_FILES_ARGUMENTS, cancelSignal);
    return parseIndexEntries(listed);
}

/**
 * Find gitlinks without opening submodule folders or reading their settings.
 *
 * @param entries the shared index listing.
 * @returns sorted, unique submodule paths.
 */
export function listSubmodulePaths(entries: GitIndexEntry[]): string[] {
    return [...new Set(entries.filter((entry) => entry.mode === GITLINK_MODE).map((entry) => entry.path))].toSorted(
        (left, right) => left.localeCompare(right),
    );
}

/**
 * List tracked and new files as sorted, root-relative paths.
 * Outside Git, walk files according to the ignore rules.
 *
 * @param repositoryRoot the folder where Git runs.
 * @param index the parsed staging area entries.
 * @param options the repository state.
 * @param options.hasGit whether the folder belongs to a Git repository.
 * @returns the entries with size, executable bit, and symlink flag.
 */
export async function listTrackedFiles(
    repositoryRoot: string,
    index: GitIndexEntry[],
    { hasGit }: { hasGit: boolean },
): Promise<ListedFile[]> {
    const listed = hasGit ? await listGitFiles(repositoryRoot, GIT_UNTRACKED_FILES_ARGUMENTS) : undefined;
    const paths =
        listed === undefined
            ? walkPaths(repositoryRoot)
            : [...index.map((entry) => entry.path), ...listed.split('\0').filter(Boolean)];
    const submodules = listSubmodulePaths(index);
    // Windows file systems keep no executable bit, so the same index listing supplies it.
    const executables =
        process.platform === 'win32'
            ? new Set(
                  index
                      .filter(
                          (entry) => entry.mode !== GITLINK_MODE && ENTRY_FILE_MODES[entry.mode] === EXECUTABLE_FILE,
                      )
                      .map((entry) => entry.path),
              )
            : undefined;
    return [...new Set(paths)]
        .filter(
            (path) =>
                !STATE_FOLDER_PATTERN.test(path.normalize('NFC')) &&
                !submodules.some((module) => isInScope(path, module)),
        )
        .toSorted((a, b) => a.localeCompare(b))
        .map((path) => readListedFile(repositoryRoot, path, executables))
        .filter((entry) => entry !== undefined);
}
