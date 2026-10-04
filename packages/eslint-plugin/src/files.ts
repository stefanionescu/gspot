import picomatch from 'picomatch';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LintedPath, RuleContext } from '#plugin/types/files.ts';
import { FILE_SCHEME, STDIN_NAMES, INDEX_BASENAMES } from '#plugin/config/files.ts';

const globCache = new Map<string, (path: string) => boolean>();

/**
 * True when a root-relative posix path matches a glob (`**`, `*`, `?`, `{a,b}`).
 * @param path the path
 * @param glob the glob
 * @returns whether the glob matches the whole path
 */
function isGlobMatch(path: string, glob: string): boolean {
    let isMatch = globCache.get(glob);
    if (!isMatch) {
        isMatch = picomatch(glob, { dot: true });
        globCache.set(glob, isMatch);
    }
    return isMatch(path);
}

/**
 * The repository root: settings.gspot.root when the config sets it, else the directory ESLint runs from.
 * @param context the rule context
 * @returns the root without a trailing slash
 */
function lintedRoot(context: RuleContext): string {
    const settings: unknown = context.settings['gspot'];
    if (settings === undefined) return normalizePath(context.cwd).replace(/\/$/u, '');
    if (settings === null || typeof settings !== 'object')
        throw new TypeError('ESLint settings.gspot must be an object.');
    const configured = 'root' in settings ? settings.root : undefined;
    if (configured !== undefined && typeof configured !== 'string')
        throw new TypeError('ESLint settings.gspot.root must be a string.');
    const root = configured ?? context.cwd;
    return normalizePath(root).replace(/\/$/u, '');
}

/**
 * Forward slashes, no query or hash, no file:// scheme, and a Windows drive letter in upper case, so two spellings of
 * one path compare equal.
 * @param value a path or file URL
 * @returns the path with forward slashes
 */
export function normalizePath(value: string): string {
    const cut = value.search(/[?#]/u);
    const cleaned = cut === -1 ? value : value.slice(0, cut);
    const isUrl = cleaned.startsWith(FILE_SCHEME);
    const bare = isUrl ? fileURLToPath(cleaned) : cleaned;
    return bare.replaceAll('\\', '/').replace(/^[a-z]:/u, (drive) => drive.toUpperCase());
}

/**
 * Resolve a relative module path against its importing file.
 * @param importer the root-relative importing file
 * @param source the module path as written
 * @returns the normalized target path, or undefined for a package or alias
 */
export function relativeImportPath(importer: string, source: string): string | undefined {
    if (!source.startsWith('./') && !source.startsWith('../')) return undefined;
    const directory = posix.dirname(importer);
    return normalizePath(posix.join(directory, source));
}

/**
 * True for an index module.
 * @param path a file path
 * @returns whether the base name is an index file
 */
export function isIndexFile(path: string): boolean {
    return INDEX_BASENAMES.has(posix.basename(normalizePath(path)));
}

/**
 * True when the path matches any glob.
 * @param path the path
 * @param globs the globs
 * @returns whether one of them matches
 */
export function isAnyGlobMatch(path: string, globs: readonly string[]): boolean {
    const excluded = globs.filter((glob) => glob.startsWith('!')).map((glob) => glob.slice(1));
    const included = globs.filter((glob) => !glob.startsWith('!'));
    return included.some((glob) => isGlobMatch(path, glob)) && excluded.every((glob) => !isGlobMatch(path, glob));
}

/**
 * Read the linted file's absolute path, root, and root-relative path once. Standard-input names have no file path.
 * @param context the ESLint rule context
 * @returns the file paths, or undefined for standard input
 */
export function lintedPath(context: RuleContext): LintedPath | undefined {
    const raw = context.physicalFilename === '' ? context.filename : context.physicalFilename;
    const absolute = normalizePath(raw);
    if (STDIN_NAMES.has(absolute)) return undefined;
    const root = lintedRoot(context);
    const relative = absolute.startsWith(`${root}/`) ? absolute.slice(root.length + 1) : absolute;
    return { absolute, relative, root };
}
