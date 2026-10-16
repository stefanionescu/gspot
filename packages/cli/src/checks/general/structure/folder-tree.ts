import { extractParentFolder } from '#cli/system/paths.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import type { DirectoryEntry } from '#cli/types/checks/general.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { INSTALLED_DEPENDENCY_FOLDERS } from '#cli/config/repository/tracked.ts';
import { isInGspotFolder, listTaggedExtensions } from '#cli/repository/classify.ts';

/**
 * The code files the folder checks look at: no Markdown and nothing under .gspot.
 * @param input the selected repository files.
 * @returns the code files.
 */
export function structureSources(input: CheckInput): TrackedFile[] {
    const documents = listTaggedExtensions('markdown');
    return input.files.filter(
        (file) =>
            file.kind === 'source' &&
            !isInGspotFolder(file.path) &&
            documents.every((extension) => !file.path.endsWith(extension)),
    );
}

/**
 * Identify dependency directories that tools own.
 * @param directory the repository-relative directory.
 * @returns whether a dependency folder contains the directory.
 */
export function isDependencyFolder(directory: string): boolean {
    return directory.split('/').some((segment) => INSTALLED_DEPENDENCY_FOLDERS.has(segment));
}

/**
 * The entries every directory holds, from the tracked files: files and the child directories they imply.
 * @param files the tracked files.
 * @returns directory path to its entries, sorted by name.
 */
export function directoryTree(files: readonly { path: string }[]): Map<string, DirectoryEntry[]> {
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
        put(extractParentFolder(file.path), name, 'file');
    }
    return new Map(
        [...tree].map(([directory, entries]) => [
            directory,
            [...entries].map(([name, kind]) => ({ name, kind })).toSorted((a, b) => a.name.localeCompare(b.name)),
        ]),
    );
}
