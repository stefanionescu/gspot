// Path handling: forward slashes in selectors, the platform form for tools.
import picomatch from 'picomatch';
import type { Dirent } from 'node:fs';
import { sep, join } from 'node:path';
import { createHash } from 'node:crypto';
import { cacheHome } from '#cli/platform/environment.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/platform.ts';
import type { GlobWalk, GlobOptions } from '#cli/types/platform.ts';
import { statSync, lstatSync, readdirSync, realpathSync } from 'node:fs';

// Refuses a pattern that climbs out of the folder it scans, in plain form, or hidden in a brace alternative.
function assertInsideFolder(pattern: string): void {
    const bare = pattern.startsWith('!') ? pattern.slice(1) : pattern;
    const climbs = bare.startsWith('/') || /(?:^|[/{,])\.\.(?=[/},]|$)/u.test(bare);
    if (climbs) throw new Error(`A path pattern cannot leave its folder: ${pattern}`);
}

// Whether a walked entry is a folder to descend into or a file to match. A link is followed only on request.
function entryKind(absolute: string, entry: Dirent, options: GlobWalk['options']): 'file' | 'folder' {
    if (!entry.isSymbolicLink()) return entry.isDirectory() ? 'folder' : 'file';
    if (!options.followSymlinks) return 'file';
    const target = statSync(absolute, { throwIfNoEntry: false });
    if (target === undefined && options.refuseBrokenLinks) throw new Error(`A link points at nothing: ${absolute}`);
    return target?.isDirectory() === true ? 'folder' : 'file';
}

// The path of a folder entry, or undefined for a hidden entry the walk skips. A hidden entry is walked only when the
// options or the pattern name one.
function entryPath(walk: GlobWalk, folder: string, entry: Dirent): string | undefined {
    if (walk.skipsHidden && entry.name.startsWith('.')) return undefined;
    return folder === '' ? entry.name : `${folder}/${entry.name}`;
}

// Visits one entry of a walked folder, and says whether to enter it: a folder that is not pruned.
function visitEntry(walk: GlobWalk, path: string, entry: Dirent): boolean {
    const isFolder = entryKind(join(walk.cwd, path), entry, walk.options) === 'folder';
    if ((!isFolder || !walk.options.onlyFiles) && walk.matches(path)) walk.visit(path);
    return isFolder && walk.isPruned?.(path) !== true;
}

// Whether a walk that follows links reached this folder before, through another link.
function isRevisited(walk: GlobWalk, absolute: string): boolean {
    if (!walk.options.followSymlinks) return false;
    const real = realpathSync(absolute);
    if (walk.visited.has(real)) return true;
    walk.visited.add(real);
    return false;
}

// Walks one folder, as deep as the pattern reaches.
function walkFolder(walk: GlobWalk, folder: string, level: number): void {
    const absolute = join(walk.cwd, folder);
    if (level > walk.depth || isRevisited(walk, absolute)) return;
    for (const entry of readdirSync(absolute, { withFileTypes: true })) {
        const path = entryPath(walk, folder, entry);
        if (path !== undefined && visitEntry(walk, path, entry)) walkFolder(walk, path, level + 1);
    }
}

// Visits the one path a pattern without wildcards names, when it exists.
function visitLiteral(cwd: string, path: string, options: GlobWalk['options'], visit: GlobWalk['visit']): void {
    const stat = (options.followSymlinks ? statSync : lstatSync)(join(cwd, path), { throwIfNoEntry: false });
    if (stat !== undefined && (!options.onlyFiles || !stat.isDirectory())) visit(path);
}

// Walks the entries under the fixed base folder of one pattern.
function walkPattern(
    cwd: string,
    pattern: string,
    settings: Omit<GlobWalk, 'cwd' | 'matches' | 'depth' | 'skipsHidden' | 'visited'>,
): void {
    const { base, glob } = picomatch.scan(pattern);
    if (glob === '') {
        visitLiteral(cwd, base, settings.options, settings.visit);
        return;
    }
    if (statSync(join(cwd, base), { throwIfNoEntry: false })?.isDirectory() !== true) return;
    const walk: GlobWalk = {
        ...settings,
        cwd,
        matches: picomatch(pattern, { dot: settings.options.dot }),
        depth: glob.includes('**') ? Infinity : glob.split('/').length,
        skipsHidden: !settings.options.dot && !/(?:^|\/)\./u.test(glob),
        visited: new Set(),
    };
    walkFolder(walk, base, 1);
}

/**
 * Forward slashes on every platform, for selectors, records, and output.
 * @param path a path in the platform's form
 * @returns the path with forward slashes
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Selectors, records, and output spell paths with forward slashes through this one conversion.
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
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Paths handed to tools take the separator of the platform through this one conversion.
export function toPlatform(path: string): string {
    return sep === '/' ? path : path.split('/').join(sep);
}

/**
 * The last segment of a posix path.
 * @param path a posix path
 * @returns the base name
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Detection and the checks take the last segment of a repository path, which has forward slashes on every platform.
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
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The Swift build and its tests locate the private build cache by this one hash of the real root path.
export function buildFolder(root: string): string {
    const identity = createHash('sha256').update(realpathSync(root)).digest('hex');
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
    // A folder whose whole content is excluded is not walked.
    const pruned = excluded
        .filter((pattern) => pattern.endsWith('/**'))
        .map((pattern) => pattern.slice(0, -'/**'.length));
    const found = new Set<string>();
    const settings = {
        options: { dot: false, onlyFiles: true, followSymlinks: false, refuseBrokenLinks: false, ...options },
        ...(pruned.length === 0 ? {} : { isPruned: picomatch(pruned, { dot: true }) }),
        visit: (path: string) => {
            if (isExcluded?.(path) !== true) found.add(path);
        },
    };
    for (const pattern of list.filter((entry) => !entry.startsWith('!'))) walkPattern(cwd, pattern, settings);
    return [...found];
}
