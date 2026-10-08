// Path spelling and native glob selection, with explicit hidden-file and symbolic-link handling.
import picomatch from 'picomatch';
import type { Dirent } from 'node:fs';
import { EXECUTABLE_LAYOUTS } from '#cli/config/platform/paths.ts';
import { sep, join, posix, relative, isAbsolute } from 'node:path';
import { globSync, statSync, lstatSync, realpathSync } from 'node:fs';
import { DECLARATION_EXTENSIONS } from '#cli/config/platform/runtime.ts';
import type { GlobScan, GlobQuery, PathEntry, GlobOptions, DirectoryEntry } from '#cli/types/platform/paths.ts';

const hostLayout = EXECUTABLE_LAYOUTS[process.platform === 'win32' ? 'windows' : 'posix'];

// Refuses a pattern that climbs out of the folder it scans, in plain form, or hidden in a brace alternative.
function assertInsideFolder(pattern: string): void {
    const bare = pattern.startsWith('!') ? pattern.slice(1) : pattern;
    // An absolute path starts with a slash, or on Windows with a drive letter.
    const climbs = bare.startsWith('/') || /^[a-z]:/iu.test(bare) || /(?:^|[/{,])\.\.(?=[/},]|$)/u.test(bare);
    if (climbs) throw new Error(`A path pattern cannot leave its folder: ${pattern}`);
}

// A literal names one existing entry; following a broken link selects nothing.
function selectLiteral(path: string, { cwd, options, visit }: GlobScan): void {
    const entry = (options.followSymlinks ? statSync : lstatSync)(join(cwd, path), { throwIfNoEntry: false });
    if (entry !== undefined && (!options.onlyFiles || !entry.isDirectory())) visit(path);
}

// Resolve the fixed prefix before native glob expansion can follow it through a link.
function patternPrefix(pattern: string, selection: GlobScan): ReturnType<typeof picomatch.scan> | undefined {
    const { cwd, options } = selection;
    const parsed = picomatch.scan(pattern);
    const parts = parsed.base.split('/').filter((part) => part !== '' && part !== '.');
    if (
        !options.followSymlinks &&
        parts.some((_, index) => {
            const entry = lstatSync(join(cwd, ...parts.slice(0, index + 1)), { throwIfNoEntry: false });
            return entry?.isSymbolicLink() === true && (parsed.glob !== '' || index + 1 < parts.length);
        })
    )
        return undefined;
    if (parsed.glob === '') {
        selectLiteral(parsed.base, selection);
        return undefined;
    }
    return statSync(join(cwd, parsed.base), { throwIfNoEntry: false })?.isDirectory() === true ? parsed : undefined;
}

// Hidden directories and link aliases need explicit native queries at the supported Node floor.
function scanFolders(cwd: string, base: string, hidden: boolean, query: GlobQuery): void {
    const frontier = new Set([base]);
    for (const folder of frontier) {
        const directories = query(folder, '**/*');
        const next = directories.filter((path) => lstatSync(join(cwd, path)).isSymbolicLink());
        if (hidden) next.push(...[folder, ...directories].flatMap((directory) => query(directory, '.*')));
        for (const child of next) frontier.add(child);
    }
}

// Native globstar queries apply exclusion callbacks on the supported Node 24.2 floor.
function scanPattern(pattern: string, selection: GlobScan): void {
    const { cwd, options, visit } = selection;
    const parsed = patternPrefix(pattern, selection);
    if (parsed === undefined) return;
    const { base, glob } = parsed;
    const matches = picomatch(pattern, { dot: options.dot });
    const visited = new Map([[realpathSync(join(cwd, base)), base]]);
    const atBoundary = (path: string): boolean => {
        const depth = glob.includes('**') ? Infinity : glob.split('/').length;
        const level = posix.relative(base, path).split('/').length;
        return selection.isPruned(path) || level >= depth;
    };
    const pathOf = (entry: Dirent): string => {
        const parent = toPosix(relative(cwd, entry.parentPath));
        const first = options.followSymlinks ? visited.get(realpathSync(entry.parentPath)) : undefined;
        return toPosix(join(first ?? parent, entry.name));
    };
    const isFolder = (entry: Dirent, path: string): boolean =>
        entry.isDirectory() ||
        (options.followSymlinks &&
            entry.isSymbolicLink() &&
            statSync(join(cwd, path), { throwIfNoEntry: false })?.isDirectory() === true);
    const hasDuplicateTarget = (path: string): boolean => {
        const real = realpathSync(join(cwd, path));
        const first = visited.get(real);
        visited.set(real, first ?? path);
        return first !== undefined && first !== path;
    };
    const exclude = (entry: Dirent): boolean => {
        const path = pathOf(entry);
        const folder = isFolder(entry, path);
        if ((!folder || !options.onlyFiles) && matches(path)) visit(path);
        if (!folder) return entry.isSymbolicLink() && !options.followSymlinks;
        return atBoundary(path) || (options.followSymlinks && hasDuplicateTarget(path));
    };
    const query = (folder: string, pattern: string): string[] =>
        globSync(pattern, { cwd: join(cwd, folder), withFileTypes: true, exclude })
            .filter((entry) => !exclude(entry) && isFolder(entry, pathOf(entry)))
            .map((entry) => pathOf(entry));
    scanFolders(cwd, base, options.dot || /(?:^|\/)\./u.test(glob), query);
}

/**
 * Name executable candidates in the platform's preferred shim order.
 * @param name the executable name without a suffix
 * @returns names used by tool-project verification and tool discovery
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
 * A path a tool printed, with forward slashes whatever platform wrote it: test inputs and Windows tools spell
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
    const isExcluded = picomatch(excluded, { dot: true });
    // A folder whose whole content is excluded is not walked.
    const pruned = excluded
        .filter((pattern) => pattern.endsWith('/**'))
        .map((pattern) => pattern.slice(0, -'/**'.length));
    const found = new Set<string>();
    const selection: GlobScan = {
        cwd,
        options: { dot: false, onlyFiles: true, followSymlinks: false, ...options },
        isPruned: picomatch(pruned, { dot: true }),
        visit: (path) => {
            if (!isExcluded(path)) found.add(path);
        },
    };
    for (const pattern of list.filter((entry) => !entry.startsWith('!'))) scanPattern(pattern, selection);
    return [...found];
}

/**
 * Remove trailing separators from an authored scope path.
 * @param path the authored scope path
 * @returns the path without trailing slashes
 */
export function trimTrailingSlashes(path: string): string {
    let end = path.length;
    while (end > 0 && path[end - 1] === '/') end -= 1;
    return path.slice(0, end);
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

/**
 * Include each path and every directory above it.
 * @param paths the repository-relative paths
 * @returns paths and parent directories, without duplicates
 */
export function expandPaths(paths: readonly string[]): Set<string> {
    const expanded = new Set(paths);
    for (const path of paths) {
        const segments = path.split('/');
        for (let depth = 1; depth < segments.length; depth += 1) expanded.add(segments.slice(0, depth).join('/'));
    }
    return expanded;
}
