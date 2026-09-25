import type { TrackedFile } from '#cli/repository/file-classification.ts';

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
 * The base name without its extension; `.d.ts` counts as one extension.
 * @param path a path
 * @returns the stem
 */
export function stemOf(path: string): string {
    const base = path.slice(path.lastIndexOf('/') + 1);
    if (base.endsWith('.d.ts')) return base.slice(0, -'.d.ts'.length);
    const dot = base.lastIndexOf('.');
    return dot <= 0 ? base : base.slice(0, dot);
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
export function directoryTree(files: TrackedFile[]): Map<string, DirectoryEntry[]> {
    const tree = new Map<string, Map<string, DirectoryEntry['kind']>>();
    const put = (directory: string, name: string, kind: DirectoryEntry['kind']): void => {
        const entries = tree.get(directory) ?? new Map<string, DirectoryEntry['kind']>();
        entries.set(name, kind);
        tree.set(directory, entries);
    };
    for (const file of files) {
        const segments = file.path.split('/');
        for (let depth = 0; depth < segments.length - 1; depth += 1)
            put(segments.slice(0, depth).join('/'), segments[depth]!, 'dir');
        put(directoryOf(file.path), segments.at(-1)!, 'file');
    }
    return new Map(
        [...tree].map(([directory, entries]) => [
            directory,
            [...entries].map(([name, kind]) => ({ name, kind })).toSorted((a, b) => a.name.localeCompare(b.name)),
        ]),
    );
}

/** An entry a directory holds, as the tracked file list sees it. */
export type DirectoryEntry = { name: string; kind: 'file' | 'dir' };
