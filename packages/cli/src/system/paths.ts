import { sep, join, posix, isAbsolute } from 'node:path';
import { EXECUTABLE_LAYOUTS, DECLARATION_EXTENSIONS } from '#cli/config/system/paths.ts';

const systemExecutables = EXECUTABLE_LAYOUTS[process.platform === 'win32' ? 'windows' : 'posix'];

/**
Convert a path to forward slashes on every system, for path patterns, stored paths, and output.

@param path the path, with system separators.
@returns the path with forward slashes.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 77 calls in 39 files share it.
export function convertToPosixPath(path: string): string {
    return sep === '/' ? path : path.split(sep).join('/');
}

/**
Convert a POSIX path to the form of this system, for tool arguments.

@param path the path, with forward slashes.
@returns the path in the form of this system.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 4 calls in 1 file share it.
export function convertToSystemPath(path: string): string {
    return sep === '/' ? path : path.split('/').join(sep);
}

/**
Check whether a path relative to a folder stays inside it: not absolute, not the parent, and not under the parent.

@param local the path relative to the folder, with either separator.
@returns whether the path stays inside the folder.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 14 files call it.
export function isInside(local: string): boolean {
    return !(isAbsolute(local) || local === '..' || local.startsWith('../') || local.startsWith(`..${sep}`));
}

/**
Extract the extension with its dot, in lower case. Double extensions such as '.d.ts' stay whole.

@param path the path, with forward slashes.
@returns the extension, '' without an extension.
*/
export function extractExtension(path: string): string {
    const base = posix.basename(path);
    const declaration = DECLARATION_EXTENSIONS.find((extension) => base.endsWith(extension));
    if (declaration !== undefined) return declaration;
    const index = base.lastIndexOf('.');
    return index <= 0 ? '' : base.slice(index).toLowerCase();
}

/**
Remove trailing separators from a written scope path.

@param path the written scope folder.
@returns the path without trailing slashes.
*/
export function trimTrailingSlashes(path: string): string {
    let end = path.length;
    while (end > 0 && path[end - 1] === '/') end -= 1;
    return path.slice(0, end);
}

/**
Extract the parent folder of a path, '' at the root.

@param path the slash-separated location to split at the last separator.
@returns everything before the last slash.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 18 calls in 15 files share it.
export function extractParentFolder(path: string): string {
    const slash = path.lastIndexOf('/');
    return slash === -1 ? '' : path.slice(0, slash);
}

/**
Extract the base name without its extension. A declaration extension such as `.d.mts` counts as one.

@param path the file location with its complete declaration or ordinary extension.
@returns the file name after removing its extension and parent folders.
*/
export function extractBaseName(path: string): string {
    const base = posix.basename(path);
    const extension = extractExtension(base);
    return base.slice(0, base.length - extension.length);
}

/**
Collect each path and every folder above it.

@param paths the repository-relative files.
@returns the paths and parent folders, each once.
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
List the file names that an executable can have on this system, in the order the system tries them.

@param name the executable without a suffix.
@returns the names to look for.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 6 calls in 5 files share it.
export function listExecutableNames(name: string): string[] {
    return systemExecutables.executableSuffixes.map((suffix) => name + suffix);
}

/**
Find the command folder of a Python virtual environment.

@param folder the environment root.
@returns its Scripts folder on Windows, or its bin folder elsewhere.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 8 calls in 6 files share it.
export function buildVenvBinPath(folder: string): string {
    return join(folder, systemExecutables.environmentFolder);
}

/**
Locate one Python interpreter or console script inside its virtual environment.

@param folder the environment root.
@param name the Python program or console script inside the environment.
@returns the executable path, with the Python launcher suffix of this system.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 17 calls in 11 files share it.
export function buildVenvExecutablePath(folder: string, name: string): string {
    return join(buildVenvBinPath(folder), name + systemExecutables.environmentSuffix);
}

/**
List a repository folder and each parent, ending at the repository root.

@param folder the repository-relative folder, with forward slashes.
@returns the enclosing folders, nearest first, with an empty string for the root.
*/
export function listEnclosingFolders(folder: string): string[] {
    let walked = folder === '.' ? '' : folder;
    const folders = [walked];
    while (walked !== '') {
        walked = extractParentFolder(walked);
        folders.push(walked);
    }
    return folders;
}
