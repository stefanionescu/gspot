// Builds, converts, and compares system and repository paths.
import { sep, join, posix, isAbsolute } from 'node:path';
import { EXECUTABLE_LAYOUTS, DECLARATION_EXTENSIONS } from '#cli/config/system/paths.ts';

const systemExecutables = EXECUTABLE_LAYOUTS[process.platform === 'win32' ? 'windows' : 'posix'];

/**
 * Forward slashes on every operating system, for selectors, records, and output.
 * @param path a path in the operating system's form.
 * @returns the path with forward slashes.
 */
export function convertToPosixPath(path: string): string {
    return sep === '/' ? path : path.split(sep).join('/');
}

/**
 * A path a tool printed, with forward slashes on any operating system. Test inputs and Windows tools can print
 * backslashes on any operating system.
 * @param path the path as the tool printed it.
 * @returns the path with forward slashes.
 */
export function normalizeOutputPath(path: string): string {
    return path.replaceAll('\\', '/');
}

/**
 * The operating system's form, for arguments handed to tools.
 * @param path a posix path.
 * @returns the path in the operating system's form.
 */
export function convertToSystemPath(path: string): string {
    return sep === '/' ? path : path.split('/').join(sep);
}

/**
 * Whether a path relative to a folder stays inside it: not absolute, not the parent, and not under the parent.
 * @param local the path relative to the folder, with either separator.
 * @returns whether the path stays inside the folder.
 */
export function isInside(local: string): boolean {
    return !(isAbsolute(local) || local === '..' || local.startsWith('../') || local.startsWith(`..${sep}`));
}

/**
 * The extension including the dot, lowercased; '.d.ts' and similar double extensions kept.
 * @param path a posix path.
 * @returns the extension, '' without an extension.
 */
export function extractExtension(path: string): string {
    const base = posix.basename(path);
    const declaration = DECLARATION_EXTENSIONS.find((extension) => base.endsWith(extension));
    if (declaration !== undefined) return declaration;
    const index = base.lastIndexOf('.');
    return index <= 0 ? '' : base.slice(index).toLowerCase();
}

/**
 * Remove trailing separators from a written scope path.
 * @param path the written scope path.
 * @returns the path without trailing slashes.
 */
export function trimTrailingSlashes(path: string): string {
    let end = path.length;
    while (end > 0 && path[end - 1] === '/') end -= 1;
    return path.slice(0, end);
}

/**
 * The Unicode-normalized, case-insensitive key for identifying a repository path.
 * @param path the repository-relative path.
 * @returns its comparison key.
 */
export function buildPathKey(path: string): string {
    return path.normalize('NFC').toLowerCase();
}

/**
 * The directory of a path, '' at the root.
 * @param path the slash-separated location to split at its final slash.
 * @returns the directory.
 */
export function extractParentFolder(path: string): string {
    const slash = path.lastIndexOf('/');
    return slash === -1 ? '' : path.slice(0, slash);
}

/**
 * The base name without its extension; a declaration extension such as `.d.mts` counts as one.
 * @param path the file location with its complete declaration or ordinary extension.
 * @returns the file name after removing its extension and parent folders.
 */
export function extractStem(path: string): string {
    const base = posix.basename(path);
    const extension = extractExtension(base);
    return base.slice(0, base.length - extension.length);
}

/**
 * Include each path and every directory above it.
 * @param paths the repository-relative paths.
 * @returns paths and parent directories, without duplicates.
 */
export function includeParentFolders(paths: readonly string[]): Set<string> {
    const expanded = new Set(paths);
    for (const path of paths) {
        const segments = path.split('/');
        for (let depth = 1; depth < segments.length; depth += 1) expanded.add(segments.slice(0, depth).join('/'));
    }
    return expanded;
}

/**
 * Name executable candidates in the system's preferred shim order.
 * @param name the executable name without a suffix.
 * @returns names used by tool-project verification and tool discovery.
 */
export function listExecutableNames(name: string): string[] {
    return systemExecutables.executableSuffixes.map((suffix) => name + suffix);
}

/**
 * Locate the command directory of a Python virtual environment.
 * @param folder the environment directory.
 * @returns its Scripts directory on Windows or bin directory elsewhere.
 */
export function buildVenvBinPath(folder: string): string {
    return join(folder, systemExecutables.environmentFolder);
}

/**
 * Locate one Python interpreter or console script inside its virtual environment.
 * @param folder the environment directory.
 * @param name the Python program or console script inside the environment.
 * @returns the executable path with the system's Python launcher suffix.
 */
export function buildVenvExecutablePath(folder: string, name: string): string {
    return join(buildVenvBinPath(folder), name + systemExecutables.environmentSuffix);
}
