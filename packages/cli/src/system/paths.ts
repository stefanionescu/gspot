// Converts and compares system and repository paths.
import { sep, posix, isAbsolute } from 'node:path';
import { DECLARATION_EXTENSIONS } from '#cli/config/system/paths.ts';

/**
 * Forward slashes on every operating system, for selectors, records, and output.
 * @param path a path in the operating system's form.
 * @returns the path with forward slashes.
 */
export function toPosix(path: string): string {
    return sep === '/' ? path : path.split(sep).join('/');
}

/**
 * A path a tool printed, with forward slashes on any operating system. Test inputs and Windows tools can print
 * backslashes on any operating system.
 * @param path the path as the tool printed it.
 * @returns the path with forward slashes.
 */
export function toolOutputPath(path: string): string {
    return path.replaceAll('\\', '/');
}

/**
 * The operating system's form, for arguments handed to tools.
 * @param path a posix path.
 * @returns the path in the operating system's form.
 */
export function toSystemPath(path: string): string {
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
export function extensionOf(path: string): string {
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
export function pathKey(path: string): string {
    return path.normalize('NFC').toLowerCase();
}

/**
 * The directory of a path, '' at the root.
 * @param path the path.
 * @returns the directory.
 */
export function directoryOf(path: string): string {
    const slash = path.lastIndexOf('/');
    return slash === -1 ? '' : path.slice(0, slash);
}

/**
 * The base name without its extension; a declaration extension such as `.d.mts` counts as one.
 * @param path a path.
 * @returns the stem.
 */
export function stemOf(path: string): string {
    const base = posix.basename(path);
    const extension = extensionOf(base);
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
