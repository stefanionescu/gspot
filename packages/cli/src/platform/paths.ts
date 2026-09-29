// Path handling: forward slashes in selectors, the platform form for tools.
import picomatch from 'picomatch';
import { sep, join } from 'node:path';
import { realpathSync } from 'node:fs';
import { cacheHome } from '#cli/platform/environment.ts';
import type { GlobOptions } from '#cli/types/platform.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/platform.ts';

// Refuses a pattern that climbs out of the folder it scans, in plain form, or hidden in a brace alternative.
function assertInsideFolder(pattern: string): void {
    const bare = pattern.startsWith('!') ? pattern.slice(1) : pattern;
    const climbs = bare.startsWith('/') || /(?:^|[/{,])\.\.(?=[/},]|$)/u.test(bare);
    if (climbs) throw new Error(`A path pattern cannot leave its folder: ${pattern}`);
}

/**
 * Forward slashes on every platform, for selectors, records, and output.
 * @param path a path in the platform's form
 * @returns the path with forward slashes
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Forward slashes on every platform, for selectors, records, and output. 11 files make 18 calls; one owner keeps that behavior in one place.
export function toPosix(path: string): string {
    return sep === '/' ? path : path.split(sep).join('/');
}

/**
 * A path a tool printed, with forward slashes whatever platform wrote it: fixtures and Windows tools spell
 * backslashes on every platform.
 * @param path the path as the tool printed it
 * @returns the path with forward slashes
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Four output readers normalize tool paths the same way; one owner keeps the contract distinct from toPosix.
export function toolPath(path: string): string {
    return path.replaceAll('\\', '/');
}

/**
 * The platform's form, for arguments handed to tools.
 * @param path a posix path
 * @returns the path in the platform's form
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The platform's form, for arguments handed to tools. 2 files make 6 calls; one owner keeps that behavior in one place.
export function toPlatform(path: string): string {
    return sep === '/' ? path : path.split('/').join(sep);
}

/**
 * The last segment of a posix path.
 * @param path a posix path
 * @returns the base name
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The last segment of a posix path. 4 files make 8 calls; one owner keeps that behavior in one place.
export function baseName(path: string): string {
    const index = path.lastIndexOf('/');
    return index === -1 ? path : path.slice(index + 1);
}

/**
 * The extension including the dot, lowercased; '.d.ts' and similar double extensions kept.
 * @param path a posix path
 * @returns the extension, '' when there is none
 */
export function extensionOf(path: string): string {
    const base = baseName(path);
    const declaration = DECLARATION_EXTENSIONS.find((extension) => base.endsWith(extension));
    if (declaration !== undefined) return declaration;
    const index = base.lastIndexOf('.');
    return index <= 0 ? '' : base.slice(index).toLowerCase();
}

/**
 * The private build cache for the canonical repository path.
 * @param root the repository root
 * @returns the cache folder for this repository
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The private build cache for the canonical repository path. 6 files make 14 calls; one owner keeps that behavior in one place.
export function buildFolder(root: string): string {
    const identity = new Bun.CryptoHasher('sha256').update(realpathSync(root)).digest('hex');
    return join(cacheHome(), 'gspot', identity);
}

/**
 * The paths under a folder that the globs name, relative to it, with forward slashes. A `!` pattern leaves
 * its matches out. A pattern that climbs out of the folder is refused.
 * @param cwd the folder to scan
 * @param patterns one glob or several
 * @param options what to include: dot files, folders, and how links are followed
 * @returns the matching paths, each once, in scan order
 */
export function globPaths(cwd: string, patterns: string | string[], options: GlobOptions = {}): string[] {
    const list = [patterns].flat();
    for (const pattern of list) assertInsideFolder(pattern);
    const excluded = list.filter((pattern) => pattern.startsWith('!')).map((pattern) => pattern.slice(1));
    const isExcluded = excluded.length === 0 ? undefined : picomatch(excluded, { dot: true });
    const scan = {
        cwd,
        dot: false,
        onlyFiles: true,
        followSymlinks: false,
        ...options,
        throwErrorOnBrokenSymlink: options.refuseBrokenLinks === true,
    };
    const found = new Set<string>();
    for (const pattern of list.filter((entry) => !entry.startsWith('!')))
        for (const path of new Bun.Glob(pattern).scanSync(scan)) {
            const posix = toPosix(path);
            if (isExcluded?.(posix) !== true) found.add(posix);
        }
    return [...found];
}
