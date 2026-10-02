// Resolving and reading paths under a files root: every parent must be a real directory and every file private.
import { join, posix } from 'node:path';
import type { Proposed } from '#cli/types/platform/root.ts';
import { MODE_BITS, PORTABLE_LINK_TARGET } from '#cli/config/platform/root.ts';
import type { Read, Bounds, PathFormat } from '#cli/types/platform/platform.ts';
import { lstatSync, mkdirSync, type Stats, readFileSync, readlinkSync } from 'node:fs';
import { fileMode, nativePath, mutationPath, privateTarget } from '#cli/platform/safe-paths.ts';

// The directory's stat, creating it first when asked and it is absent.
function directoryStat(directory: string, create: boolean): Stats {
    try {
        return lstatSync(directory);
    } catch (error) {
        if (!create || (error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    try {
        mkdirSync(directory);
    } catch (creationError) {
        if ((creationError as NodeJS.ErrnoException).code !== 'EEXIST') throw creationError;
    }
    return lstatSync(directory);
}

// The snapshot of a symbolic link: its target text and its own mode.
function linkRead(target: string, stat: Stats): Read {
    const bytes = Buffer.from(readlinkSync(target));
    const mode = fileMode({ mode: stat.mode & MODE_BITS, isLink: true });
    return { bytes, mode, isLink: true };
}

// The snapshot of a regular file, refusing one that changed while it was read.
function fileRead(target: string, stat: Stats, path: string): Read {
    if (!stat.isFile() || stat.nlink !== 1)
        throw new Error(`Lifecycle destination is not a private regular file: ${path}`);
    const bytes = readFileSync(target);
    const after = lstatSync(target);
    if (stat.size !== bytes.length || stat.mtimeMs !== after.mtimeMs || stat.ctimeMs !== after.ctimeMs)
        throw new Error(`Lifecycle destination changed while being read: ${path}`);
    return { bytes, mode: fileMode({ mode: stat.mode & MODE_BITS }) };
}

// Whether a link's target text is one the lifecycle refuses: not valid UTF-8, empty, absolute, or unsafe.
function isUnsafeLinkTarget(bounds: Bounds, value: Read, target: string): boolean {
    if (!Buffer.from(target).equals(value.bytes) || target === '' || target.startsWith('/')) return true;
    return bounds.pathFormat === 'portable' ? PORTABLE_LINK_TARGET.test(target) : target.includes('\0');
}

// Refuses a link whose destination is missing or is itself a link, reading proposed files before the disk.
function assertLinkDestination(bounds: Bounds, path: string, destination: string, proposed?: Proposed): void {
    const targetFile =
        proposed?.has(destination) === true ? proposed.get(destination) : readEntry(bounds, destination, false);
    if (targetFile === undefined) throw new Error(`Lifecycle link target is missing: ${path}`);
    if (targetFile.isLink) throw new Error(`Lifecycle link target is not a regular file: ${path}`);
}

/**
 * The bounds of one root: where it is and how its paths are spelled.
 * @param canonical the real path of the root
 * @param pathFormat whether paths use forward slashes or the platform's own spelling
 * @returns the bounds
 */
export function boundsOf(canonical: string, pathFormat: PathFormat): Bounds {
    const partsOf = pathFormat === 'portable' ? mutationPath : nativePath;
    const locks = new Map<string, string>();
    return { canonical, pathFormat, partsOf, locks };
}

/**
 * The absolute path of an entry, after checking that every parent is a real directory and not a link.
 * @param bounds the root
 * @param path the files path
 * @param create whether absent parents are created
 * @returns the absolute path
 */
export function parentPath(bounds: Bounds, path: string, create = false): string {
    const parts = bounds.partsOf(path);
    const leaf = parts.pop();
    if (leaf === undefined) throw new Error('A path inside the root cannot be empty.');
    let directory = bounds.canonical;
    for (const part of parts) {
        directory = join(directory, part);
        const stat = directoryStat(directory, create);
        if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Unsafe lifecycle parent: ${path}`);
    }
    return join(directory, leaf);
}

/**
 * The snapshot at a path, or undefined when nothing is there.
 * @param bounds the root
 * @param path the files path
 * @param allowLink whether a symbolic link is read as itself instead of refused
 * @returns the snapshot
 */
export function readEntry(bounds: Bounds, path: string, allowLink: boolean): Read | undefined {
    try {
        const target = parentPath(bounds, path);
        const stat = lstatSync(target);
        if (allowLink && stat.isSymbolicLink()) return linkRead(target, stat);
        return fileRead(target, stat, path);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
        throw error;
    }
}

/**
 * Checks a snapshot's path and, for a link, its target, which must be a normalized relative path to a regular file
 * inside the root.
 * @param bounds the root.
 * @param path the files path.
 * @param value the snapshot.
 * @param proposed files about to be written, consulted before the disk for a link's destination.
 * @returns the link target text, or undefined for a regular file.
 */
export function validateRead(bounds: Bounds, path: string, value: Read, proposed?: Proposed): string | undefined {
    bounds.partsOf(path);
    if (!value.isLink) return undefined;
    const target = value.bytes.toString('utf8');
    if (isUnsafeLinkTarget(bounds, value, target)) throw new Error(`Unsafe lifecycle link target: ${path}`);
    const destination = posix.join(posix.dirname(path), target);
    bounds.partsOf(destination);
    privateTarget(destination);
    if (posix.relative(posix.dirname(path), destination) !== target)
        throw new Error(`Lifecycle link target must use a normalized relative path: ${path}`);
    assertLinkDestination(bounds, path, destination, proposed);
    return target;
}
