// Path spelling and glob walks, with explicit hidden-file and symbolic-link selection.
import picomatch from 'picomatch';
import type { Dirent } from 'node:fs';
import { sep, join, posix, isAbsolute } from 'node:path';
import { EXECUTABLE_LAYOUTS } from '#cli/config/platform/paths.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/platform/runtime.ts';
import { statSync, lstatSync, readdirSync, realpathSync } from 'node:fs';
import type { GlobWalk, PathEntry, GlobOptions, DirectoryEntry } from '#cli/types/platform/paths.ts';

const hostLayout = EXECUTABLE_LAYOUTS[process.platform === 'win32' ? 'windows' : 'posix'];

// Refuses a pattern that climbs out of the folder it scans, in plain form, or hidden in a brace alternative.
function assertInsideFolder(pattern: string): void {
    const bare = pattern.startsWith('!') ? pattern.slice(1) : pattern;
    // An absolute path starts with a slash, or on Windows with a drive letter.
    const climbs = bare.startsWith('/') || /^[a-z]:/iu.test(bare) || /(?:^|[/{,])\.\.(?=[/},]|$)/u.test(bare);
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
    const parts = base.split('/').filter((part) => part !== '' && part !== '.');
    const blocked =
        !settings.options.followSymlinks &&
        parts.some((_, index) => {
            const count = index + 1;
            const entry = lstatSync(join(cwd, ...parts.slice(0, count)), { throwIfNoEntry: false });
            return entry?.isSymbolicLink() === true && (glob !== '' || count < parts.length);
        });
    if (blocked) return;
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
 * Name executable candidates in the platform's preferred shim order.
 * @param name the executable name without a suffix
 * @returns names used by private-package verification and tool discovery
 */
export function executableNames(name: string): string[] {
    return hostLayout.executableSuffixes.map((suffix) => name + suffix);
}

/**
 * Locate the command directory of a Python virtual environment.
 * @param folder the environment directory
 * @returns its Scripts directory on Windows or bin directory elsewhere
 */
export function environmentBin(folder: string): string {
    return join(folder, hostLayout.environmentDirectory);
}

/**
 * Locate one Python interpreter or console script inside its virtual environment.
 * @param folder the environment directory
 * @param name the executable name
 * @returns the executable path with the platform's Python launcher suffix
 */
export function environmentExecutable(folder: string, name: string): string {
    return join(environmentBin(folder), name + hostLayout.environmentSuffix);
}

/**
 * Forward slashes on every platform, for selectors, records, and output.
 * @param path a path in the platform's form
 * @returns the path with forward slashes
 */
export function toPosix(path: string): string {
    return sep === '/' ? path : path.split(sep).join('/');
}

/**
 * A path a tool printed, with forward slashes whatever platform wrote it: fixtures and Windows tools spell
 * backslashes on every platform.
 * @param path the path as the tool printed it
 * @returns the path with forward slashes
 */
export function toolPath(path: string): string {
    return path.replaceAll('\\', '/');
}

/**
 * The platform's form, for arguments handed to tools.
 * @param path a posix path
 * @returns the path in the platform's form
 */
export function toPlatform(path: string): string {
    return sep === '/' ? path : path.split('/').join(sep);
}

/**
 * Whether a path relative to a folder stays inside it: not absolute, not the parent, and not under the parent.
 * @param local the path relative to the folder, with either separator
 * @returns whether the path stays inside the folder
 */
export function isInside(local: string): boolean {
    return !(isAbsolute(local) || local === '..' || local.startsWith('../') || local.startsWith(`..${sep}`));
}

/**
 * The extension including the dot, lowercased; '.d.ts' and similar double extensions kept.
 * @param path a posix path
 * @returns the extension, '' when there is none
 */
export function extensionOf(path: string): string {
    const base = posix.basename(path);
    const declaration = DECLARATION_EXTENSIONS.find((extension) => base.endsWith(extension));
    if (declaration !== undefined) return declaration;
    const index = base.lastIndexOf('.');
    return index <= 0 ? '' : base.slice(index).toLowerCase();
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

/**
 * The Unicode-normalized, case-insensitive key for identifying a repository path.
 * @param path the repository-relative path
 * @returns its comparison key
 */
export function pathKey(path: string): string {
    return path.normalize('NFC').toLowerCase();
}

/**
 * The directory of a path, '' at the root.
 * @param path the path
 * @returns the directory
 */
export function directoryOf(path: string): string {
    const slash = path.lastIndexOf('/');
    return slash === -1 ? '' : path.slice(0, slash);
}

/**
 * The base name without its extension; a declaration extension such as `.d.mts` counts as one.
 * @param path a path
 * @returns the stem
 */
export function stemOf(path: string): string {
    const base = posix.basename(path);
    const extension = extensionOf(base);
    return base.slice(0, base.length - extension.length);
}

/**
 * A grouping prefix: the stem up to its first dash or dot.
 * @param stem a file stem
 * @returns the prefix
 */
export function prefixOf(stem: string): string {
    const cuts = [stem.indexOf('-'), stem.indexOf('.')].filter((index) => index >= 0);
    return cuts.length === 0 ? stem : stem.slice(0, Math.min(...cuts));
}

/**
 * The entries every directory holds, from the tracked files: files and the child directories they imply.
 * @param files the tracked files
 * @returns directory path to its entries, sorted by name
 */
export function directoryTree(files: readonly PathEntry[]): Map<string, DirectoryEntry[]> {
    const tree = new Map<string, Map<string, DirectoryEntry['kind']>>();
    const put = (directory: string, name: string, kind: DirectoryEntry['kind']): void => {
        const entries = tree.get(directory) ?? new Map<string, DirectoryEntry['kind']>();
        entries.set(name, kind);
        tree.set(directory, entries);
    };
    for (const file of files) {
        const segments = file.path.split('/');
        const name = segments.pop();
        if (name === undefined) continue;
        for (const [depth, segment] of segments.entries()) put(segments.slice(0, depth).join('/'), segment, 'dir');
        put(directoryOf(file.path), name, 'file');
    }
    return new Map(
        [...tree].map(([directory, entries]) => [
            directory,
            [...entries].map(([name, kind]) => ({ name, kind })).toSorted((a, b) => a.name.localeCompare(b.name)),
        ]),
    );
}
