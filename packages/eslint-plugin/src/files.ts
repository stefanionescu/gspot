import type { TSESLint } from '@typescript-eslint/utils';
// Index and barrel detection, file classes, directory reads and the small glob matcher the rules share.
import picomatch from 'picomatch';
import { posix } from 'node:path';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { AST_NODE_TYPES } from '@typescript-eslint/utils';

const INDEX_BASENAMES = new Set([
    'index.ts',
    'index.tsx',
    'index.js',
    'index.jsx',
    'index.mjs',
    'index.cjs',
    'index.mts',
    'index.cts',
]);
const STDIN_NAMES = new Set(['', '<input>', '<text>']);
const FILE_SCHEME = 'file://';
const DECLARATION_SUFFIX = '.d.ts';

const globCache = new Map<string, (path: string) => boolean>();

function aliasTarget(source: string, prefix: string, target: string): string | undefined {
    const clean = prefix.endsWith('*') ? prefix.slice(0, -1) : prefix;
    const bare = clean.endsWith('/') ? clean.slice(0, -1) : clean;
    if (source !== bare && !source.startsWith(clean)) return undefined;
    const rest = source.slice(clean.length);
    const base = target.endsWith('*') ? target.slice(0, -1) : target;
    return posix.join(base, rest);
}

/** The extensions of code files the rules look at. */
export const CODE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.svelte'];

/**
 * Forward slashes, no query or hash, no file:// scheme.
 * @param value a path or file URL
 * @returns the path with forward slashes
 */
export function normalizePath(value: string): string {
    const cut = value.search(/[?#]/u);
    const cleaned = cut === -1 ? value : value.slice(0, cut);
    const isUrl = cleaned.startsWith(FILE_SCHEME);
    const bare = isUrl ? fileURLToPath(cleaned) : cleaned;
    return bare.replaceAll('\\', '/');
}

/**
 * The file ESLint is linting, normalized, or undefined for stdin.
 * @param context the rule context
 * @returns the path, or undefined when ESLint reads stdin
 */
export function lintedFile(context: RuleContextOf): string | undefined {
    const raw = context.physicalFilename === '' ? context.filename : context.physicalFilename;
    const normalized = normalizePath(raw);
    return STDIN_NAMES.has(normalized) ? undefined : normalized;
}

/**
 * The repository root: settings.gspot.root when the config sets it, else the directory ESLint runs from.
 * @param context the rule context
 * @returns the root without a trailing slash
 */
export function lintedRoot(context: RuleContextOf): string {
    const settings = (context.settings as { gspot?: { root?: string } } | undefined)?.gspot;
    const root = settings?.root ?? context.cwd;
    return normalizePath(root).replace(/\/$/u, '');
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
 * The base name without its extension; `.d.ts` counts as one extension.
 * @param path a file path
 * @returns the stem
 */
export function stemOf(path: string): string {
    const base = posix.basename(path);
    if (base.endsWith(DECLARATION_SUFFIX)) return base.slice(0, -DECLARATION_SUFFIX.length);
    const dot = base.lastIndexOf('.');
    return dot <= 0 ? base : base.slice(0, dot);
}

/**
 * A grouping prefix: the stem up to its first dash or dot.
 * @param stem a file stem
 * @returns the prefix, or the whole stem when it has no dash or dot
 */
export function prefixOf(stem: string): string {
    const cuts = [stem.indexOf('-'), stem.indexOf('.')].filter((index) => index >= 0);
    return cuts.length === 0 ? stem : stem.slice(0, Math.min(...cuts));
}

/**
 * Current directory entries. Read failures propagate to the caller.
 * @param dir the directory
 * @returns files and directories, sorted by name
 */
export function readDirectory(dir: string): DirectoryEntry[] {
    return readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isFile() || entry.isDirectory())
        .map((entry): DirectoryEntry => ({ name: entry.name, kind: entry.isDirectory() ? 'dir' : 'file' }))
        .toSorted((a, b) => a.name.localeCompare(b.name));
}

/**
 * True when a root-relative posix path matches a glob (`**`, `*`, `?`, `{a,b}`).
 * @param path the path
 * @param glob the glob
 * @returns whether the glob matches the whole path
 */
export function isGlobMatch(path: string, glob: string): boolean {
    let isMatch = globCache.get(glob);
    if (!isMatch) {
        isMatch = picomatch(glob, { dot: true });
        globCache.set(glob, isMatch);
    }
    return isMatch(path);
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
 * The path relative to the root, or the path itself when outside it.
 * @param root the repository root
 * @param path an absolute path
 * @returns the relative path
 */
export function relativeToRoot(root: string, path: string): string {
    return path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path;
}

/**
 * The file an import source names, relative imports against the importer and aliases against the root; undefined for packages.
 * @param importer the importing file
 * @param source the import source as written
 * @param root the repository root
 * @param aliases alias prefix to target directory, both optionally ending in `*`
 * @returns the file's path without an extension check, or undefined
 */
export function importFile(
    importer: string,
    source: string,
    root: string,
    aliases: Readonly<Record<string, string>> = {},
): string | undefined {
    if (source.startsWith('.')) {
        const joined = posix.join(posix.dirname(importer), source);
        return normalizePath(posix.normalize(joined));
    }
    for (const [prefix, target] of Object.entries(aliases)) {
        const aliased = aliasTarget(source, prefix, target);
        if (aliased !== undefined) return normalizePath(posix.normalize(posix.join(root, aliased)));
    }
    return undefined;
}

/**
 * The static string of a literal node, or undefined.
 * @param node any node
 * @returns the string when the node is a string literal
 */
export function staticString(node: unknown): string | undefined {
    const literal = node as { type?: string; value?: unknown } | null | undefined;
    return literal?.type === AST_NODE_TYPES.Literal && typeof literal.value === 'string' ? literal.value : undefined;
}

export type DirectoryEntry = { name: string; kind: 'file' | 'dir' };

export type RuleContextOf = Readonly<TSESLint.RuleContext<string, unknown[]>>;
