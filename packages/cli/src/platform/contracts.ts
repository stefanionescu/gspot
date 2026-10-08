import { isUtf8 } from 'node:buffer';
import { createHash } from 'node:crypto';
import { distance } from 'fastest-levenshtein';
import { sep, join, posix, isAbsolute } from 'node:path';
import type { Defined } from '#cli/types/platform/runtime.ts';
import { EXECUTABLE_LAYOUTS } from '#cli/config/platform/paths.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/platform/runtime.ts';
import type { PathEntry, DirectoryEntry } from '#cli/types/platform/paths.ts';
import { TYPO_MIN, LIST_LIMIT, TYPO_FRACTION, SUGGESTION_LIMIT } from '#cli/config/platform/text.ts';

const hostLayout = EXECUTABLE_LAYOUTS[process.platform === 'win32' ? 'windows' : 'posix'];

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

/**
 * Drops the undefined entries of an object, so exact optional types hold.
 * @param value any object
 * @returns the same object without its undefined entries
 */
export function compact<T extends object>(value: T): Defined<T> {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Defined<T>;
}

/**
 * Whether a parsed value is a plain object of named values: not null, not a list, and not a date.
 * @param value the value
 * @returns whether the value holds keys
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);
}

/**
 * Identify nonempty arrays of parsed tables for native section layout.
 * @param value a parsed value
 * @returns whether each array item is a plain table
 */
export function isRecordArray(value: unknown): value is Record<string, unknown>[] {
    return Array.isArray(value) && value.length > 0 && value.every(isRecord);
}

/**
 * The value at a key path inside a parsed object.
 * @param value the parsed object
 * @param keys the keys, outermost first
 * @returns the value, or undefined when any key along the path is absent
 */
export function valueAt(value: unknown, keys: readonly (string | number)[]): unknown {
    let current = value;
    for (const key of keys) {
        if (current === null || typeof current !== 'object' || !Object.hasOwn(current, key)) return undefined;
        current = (current as Record<string, unknown>)[key];
    }
    return current;
}

/**
 * Give parsed objects a consistent null prototype while preserving dates and array order.
 * @param value a parsed or edited field
 * @returns the same values with consistent object prototypes
 */
export function normalizeTables(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((entry) => normalizeTables(entry));
    if (!isRecord(value)) return value;
    const table = Object.fromEntries<unknown>(
        Object.entries(value).map(([key, entry]) => [key, normalizeTables(entry)]),
    );
    Object.setPrototypeOf(table, null);
    return table;
}

/**
 * Creates the missing tables along a dotted path.
 * @param raw the parsed document.
 * @param path the table names from the root down.
 * @returns the table at the end of the path, or undefined when the path is missing or runs through a value.
 */
export function createTable(raw: Record<string, unknown>, path: string[]): Record<string, unknown> | undefined {
    let current = raw;
    for (const part of path) {
        let next = current[part];
        if (next === undefined) {
            next = {};
            current[part] = next;
        }
        if (!isRecord(next)) return undefined;
        current = next;
    }
    return current;
}

/**
 * Up to three candidates within an edit distance that reads as a typo, closest first.
 * @param name the name as typed
 * @param candidates the names that exist
 * @returns the closest candidates
 */
export function similar(name: string, candidates: string[]): string[] {
    const lower = name.toLowerCase();
    const limit = Math.max(TYPO_MIN, Math.floor(name.length / TYPO_FRACTION));
    return candidates
        .map((candidate) => ({ candidate, score: distance(lower, candidate.toLowerCase()) }))
        .filter(
            ({ candidate, score }) =>
                score <= limit || candidate.toLowerCase().includes(lower) || lower.includes(candidate.toLowerCase()),
        )
        .toSorted((a, b) => a.score - b.score)
        .slice(0, SUGGESTION_LIMIT)
        .map(({ candidate }) => candidate);
}

/**
 * Names in code spans, separated by commas, with the count of the rest past the limit.
 * @param items the names
 * @returns the list text
 */
export function codeList(items: string[]): string {
    const shown = items.slice(0, LIST_LIMIT);
    const rest = items.length - shown.length;
    const more = rest > 0 ? ` and ${String(rest)} more` : '';
    return shown.map((item) => `\`${item}\``).join(', ') + more;
}

/**
 * The SHA-256 digest of text or bytes, in lowercase hex.
 * @param content the text or bytes
 * @returns the digest
 */
export function contentDigest(content: string | Uint8Array): string {
    return createHash('sha256').update(content).digest('hex');
}

/**
 * Bytes as text, when they are UTF-8.
 * @param bytes the bytes
 * @returns the text, or undefined when the bytes are not UTF-8
 */
export function decodeUtf8(bytes: Uint8Array): string | undefined {
    return isUtf8(bytes) ? Buffer.from(bytes).toString('utf8') : undefined;
}

/**
 * Quote one argument for a POSIX shell command shown to the reader.
 * @param value the argument
 * @returns the argument, quoted when it needs to be
 */
export function quoteArgument(value: string): string {
    if (/^[a-zA-Z0-9_./-]+$/u.test(value)) return value;
    return `'${value.replaceAll("'", "'\"'\"'")}'`;
}
