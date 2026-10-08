// Resolving and reading paths inside one root: every parent must be a real directory and every file private.
import type { Stats } from 'node:fs';
import { isInside } from '#cli/platform/paths.ts';
import { join, posix, relative } from 'node:path';
import { GspotError } from '#cli/platform/errors.ts';
import { MODE_BITS } from '#cli/config/platform/modes.ts';
import { PORTABLE_LINK_TARGET } from '#cli/config/platform/root.ts';
import type { Bounds, FileCopy, PathFormat, PlannedFiles } from '#cli/types/platform/root.ts';
import { lstatSync, mkdirSync, existsSync, readFileSync, readlinkSync, realpathSync } from 'node:fs';
import { fileMode, nativeSegments, assertNotPrivate, portableSegments } from '#cli/platform/root/rules.ts';

// A missing parent is created; a competing creator may finish before this one does.
function preparedDirectory(directory: string): Stats {
    try {
        return lstatSync(directory);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    try {
        mkdirSync(directory);
    } catch (creationError) {
        if ((creationError as NodeJS.ErrnoException).code !== 'EEXIST') throw creationError;
    }
    return lstatSync(directory);
}

// The copy of a symbolic link: its target text and its own mode.
function linkRead(target: string, stat: Stats): FileCopy {
    const bytes = Buffer.from(readlinkSync(target));
    const mode = fileMode({ mode: stat.mode & MODE_BITS, isLink: true });
    return { bytes, mode, isLink: true };
}

// The copy of a regular file, refusing one that changed while it was read.
function fileRead(target: string, stat: Stats, path: string): FileCopy {
    if (!stat.isFile() || stat.nlink !== 1)
        throw new Error(`Lifecycle destination is not a private regular file: ${path}`);
    const bytes = readFileSync(target);
    const after = lstatSync(target);
    if (stat.size !== bytes.length || stat.mtimeMs !== after.mtimeMs || stat.ctimeMs !== after.ctimeMs)
        throw new Error(`Lifecycle destination changed while being read: ${path}`);
    return { bytes, mode: fileMode({ mode: stat.mode & MODE_BITS }) };
}

// Whether a link's target text is one the lifecycle refuses: not valid UTF-8, empty, absolute, or unsafe.
function isUnsafeLinkTarget(bounds: Bounds, value: FileCopy, target: string): boolean {
    if (!Buffer.from(target).equals(value.bytes) || target === '' || target.startsWith('/')) return true;
    return bounds.pathFormat === 'portable' ? PORTABLE_LINK_TARGET.test(target) : target.includes('\0');
}

// Refuses a link whose destination is missing or is itself a link, reading proposed files before the disk.
function assertLinkDestination(bounds: Bounds, path: string, destination: string, plannedFiles?: PlannedFiles): void {
    const targetFile =
        plannedFiles?.has(destination) === true ? plannedFiles.get(destination) : readEntry(bounds, destination, false);
    if (targetFile === undefined) throw new Error(`Lifecycle link target is missing: ${path}`);
    if (targetFile.isLink) throw new Error(`Lifecycle link target is not a regular file: ${path}`);
}

/**
 * The bounds of one root: where it is and how its paths are spelled.
 * @param canonical the real path of the root
 * @param pathFormat portable refuses names another supported OS reads differently; native accepts names this OS allows; both take forward slashes
 * @returns the bounds
 */
export function boundsOf(canonical: string, pathFormat: PathFormat): Bounds {
    const partsOf = pathFormat === 'portable' ? portableSegments : nativeSegments;
    const claims = new Map<string, string>();
    return { canonical, pathFormat, partsOf, claims };
}

/**
 * The absolute path of an entry, after checking that every parent is a real directory and not a link.
 * @param bounds the root
 * @param path the root-relative path
 * @returns the absolute path
 */
export function checkedPath(bounds: Bounds, path: string): string {
    const parts = bounds.partsOf(path);
    const leaf = parts.pop();
    if (leaf === undefined) throw new Error('A path inside the root cannot be empty.');
    let directory = bounds.canonical;
    for (const part of parts) {
        directory = join(directory, part);
        const stat = lstatSync(directory);
        if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Unsafe lifecycle parent: ${path}`);
    }
    return join(directory, leaf);
}

/**
 * The absolute path of an entry, creating missing parents and refusing linked or non-directory parents.
 * @param bounds the root
 * @param path the root-relative path
 * @returns the absolute path after its parents are prepared
 */
export function preparedPath(bounds: Bounds, path: string): string {
    const parts = bounds.partsOf(path);
    const leaf = parts.pop();
    if (leaf === undefined) throw new Error('A path inside the root cannot be empty.');
    let directory = bounds.canonical;
    for (const part of parts) {
        directory = join(directory, part);
        const stat = preparedDirectory(directory);
        if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Unsafe lifecycle parent: ${path}`);
    }
    return join(directory, leaf);
}

/**
 * The copy at a path, or undefined when nothing is there.
 * @param bounds the root
 * @param path the root-relative path
 * @param allowLink whether a symbolic link is read as itself instead of refused
 * @returns the copy
 */
export function readEntry(bounds: Bounds, path: string, allowLink: boolean): FileCopy | undefined {
    try {
        const target = checkedPath(bounds, path);
        const stat = lstatSync(target);
        if (allowLink && stat.isSymbolicLink()) return linkRead(target, stat);
        return fileRead(target, stat, path);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
        throw error;
    }
}

/**
 * Checks a copy's path and, for a link, its target, which must be a normalized relative path to a regular file
 * inside the root.
 * @param bounds the root.
 * @param path the root-relative path.
 * @param value the copy.
 * @param plannedFiles files about to be written, consulted before the disk for a link's destination.
 * @returns the link target text, or undefined for a regular file.
 */
export function validateRead(
    bounds: Bounds,
    path: string,
    value: FileCopy,
    plannedFiles?: PlannedFiles,
): string | undefined {
    bounds.partsOf(path);
    if (!value.isLink) return undefined;
    const target = value.bytes.toString('utf8');
    if (isUnsafeLinkTarget(bounds, value, target)) throw new Error(`Unsafe lifecycle link target: ${path}`);
    const destination = posix.join(posix.dirname(path), target);
    bounds.partsOf(destination);
    assertNotPrivate(destination);
    if (posix.relative(posix.dirname(path), destination) !== target)
        throw new Error(`Lifecycle link target must use a normalized relative path: ${path}`);
    assertLinkDestination(bounds, path, destination, plannedFiles);
    return target;
}

/**
 * Resolve a native path and distinguish an unavailable runtime operation from a missing file.
 * @param path the native filesystem path to resolve
 * @returns its canonical native spelling
 * @throws when the runtime cannot resolve an existing path, or the filesystem operation fails
 */
export function canonicalPath(path: string): string {
    try {
        return realpathSync(path);
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT' && existsSync(path))
            throw new GspotError(
                'filesystem',
                `The runtime cannot resolve this existing filesystem path: ${path}. Check runtime support for this path.`,
                { cause: error },
            );
        throw error;
    }
}

/**
 * Resolve an authored source while refusing links outside its canonical root.
 * @param root the canonical directory
 * @param path the root-relative source
 * @param partsOf the owner's path validation
 * @returns the contained native path
 */
export function sourcePath(root: string, path: string, partsOf = nativeSegments): string {
    const target = canonicalPath(join(root, ...partsOf(path)));
    if (!isInside(relative(root, target))) throw new Error(`Source link leaves the repository: ${path}`);
    return target;
}
