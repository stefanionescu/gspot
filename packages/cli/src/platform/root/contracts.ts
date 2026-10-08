// The path spellings and file copies the lifecycle accepts, and the metadata paths it keeps to itself.
import picomatch from 'picomatch';
import type { Dirent } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { join, posix, relative } from 'node:path';
import { toPosix } from '#cli/platform/contracts.ts';
import type { FileCopy } from '#cli/types/platform/root.ts';
import { MARKERS } from '#cli/config/platform/managed-blocks.ts';
import { globSync, statSync, lstatSync, realpathSync } from 'node:fs';
import type { BlockSpan, BlockContext } from '#cli/types/platform/managed-blocks.ts';
import type { GlobScan, GlobQuery, GlobOptions } from '#cli/types/platform/paths.ts';
import { WRITABLE_FILE, READ_ONLY_FILE, OWNER_WRITE_BIT } from '#cli/config/platform/modes.ts';
import { DEVICE_NAME, UNSAFE_PATH_END, UNSAFE_CHARACTERS, LIFECYCLE_PRIVATE_PATH } from '#cli/config/platform/root.ts';

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

// Whether one segment of a portable path means something different on a supported operating system.
function isUnsafeSegment(part: string): boolean {
    if (['', '.', '..'].includes(part)) return true;
    if (UNSAFE_CHARACTERS.test(part) || UNSAFE_PATH_END.test(part)) return true;
    return DEVICE_NAME.test(part);
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
 * Compare only permissions represented by the host filesystem API. Windows exposes a read-only flag.
 * @param file the copy's mode and whether it is a link
 * @param platform the platform whose permission model applies
 * @returns the mode the platform can represent
 */
export function fileMode(file: Pick<FileCopy, 'mode' | 'isLink'>, platform = process.platform): number {
    if (platform !== 'win32') return file.mode;
    if (file.isLink || (file.mode & OWNER_WRITE_BIT) !== 0) return WRITABLE_FILE;
    return READ_ONLY_FILE;
}

/**
 * Whether two copies hold the same bytes and the same mode as the host can represent it.
 * @param found the copy read from disk
 * @param expected the copy the caller expects there
 * @returns true when both are absent or both match
 */
export function sameEntry(found: FileCopy | undefined, expected: FileCopy | undefined): boolean {
    if (found === undefined || expected === undefined) return found === expected;
    const read = { ...found, mode: fileMode(found) };
    const requested = { ...expected, mode: fileMode(expected) };
    return isDeepStrictEqual(read, requested);
}

/**
 * Reject path spellings that have different meanings on supported operating systems.
 * @param path a repository-relative path with forward slashes
 * @returns the path's segments
 */
export function portableSegments(path: string): string[] {
    const parts = path.split('/');
    if (parts.some((part) => isUnsafeSegment(part))) throw new Error(`Unsafe lifecycle path: ${JSON.stringify(path)}`);
    return parts;
}

/**
 * Splits a path into segments and refuses an empty, dot, parent, or NUL segment.
 * @param path a repository-relative path with forward slashes
 * @returns the path's segments
 */
export function nativeSegments(path: string): string[] {
    if (process.platform === 'win32') return portableSegments(path);
    const parts = path.split('/');
    if (parts.some((part) => part === '' || part === '.' || part === '..' || part.includes('\0')))
        throw new Error(`Unsafe lifecycle path: ${JSON.stringify(path)}`);
    return parts;
}

/**
 * Refuses a path inside the lifecycle's own metadata.
 * @param path the proposed path
 */
export function assertNotPrivate(path: string): void {
    if (LIFECYCLE_PRIVATE_PATH.test(path.normalize('NFC')))
        throw new Error(`Lifecycle metadata is not a generated target: ${path}`);
}

/**
 * Public mutation plans cannot target the owner's log, claim, or recovery files.
 * @param path the proposed path
 */
export function assertMutationTarget(path: string): void {
    portableSegments(path);
    assertNotPrivate(path);
}

/**
 * Locate one complete block. Refuse ambiguous or malformed markers.
 * @param text the file text
 * @param context the file path and marker style
 * @returns the block's character range, or undefined when the file holds none
 */
export function blockSpan(text: string, context: BlockContext): BlockSpan | undefined {
    const markersForStyle = MARKERS[context.style];
    const start = text.indexOf(markersForStyle.start);
    const closing = text.indexOf(markersForStyle.end);
    if (start === -1 && closing === -1) return undefined;
    if (
        start === -1 ||
        closing < start ||
        text.includes(markersForStyle.start, start + markersForStyle.start.length) ||
        text.includes(markersForStyle.end, closing + markersForStyle.end.length)
    ) {
        throw new Error(
            `${context.path} has incomplete or repeated gspot block markers. Fix the markers, then run gspot apply.`,
        );
    }
    const end = closing + markersForStyle.end.length;
    const newline = /^\r?\n/u.exec(text.slice(end));
    if (newline !== null) return { start, end: end + newline[0].length };
    return { start, end };
}

/**
 * Replace a complete block or append it, preserving authored bytes around it.
 * @param existing the file text
 * @param block the block body to install
 * @param context the file path and marker style
 * @returns the file text with the block in place
 */
export function applyBlock(existing: string, block: string, context: BlockContext): string {
    const { start, end } = MARKERS[context.style];
    const gap = context.style === 'markdown' ? '\n\n' : '\n';
    const body = `${start}${gap}${block.trim()}${gap}${end}\n`;
    const span = blockSpan(existing, context);
    if (span !== undefined) return existing.slice(0, span.start) + body + existing.slice(span.end);
    if (existing === '') return body;
    const separator = existing.endsWith('\n') ? '\n' : '\n\n';
    return existing + separator + body;
}

/**
 * The block currently in a file, or undefined.
 * @param text the file's text
 * @param context the file path and marker style
 * @returns the block body, trimmed
 */
export function currentBlock(text: string, context: BlockContext): string | undefined {
    const span = blockSpan(text, context);
    if (span === undefined) return undefined;
    const { start, end } = MARKERS[context.style];
    const block = text.slice(span.start, span.end).trimEnd();
    return block.slice(start.length, -end.length).trim();
}
