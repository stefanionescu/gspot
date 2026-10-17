import { extractParentFolder } from '#cli/system/paths.ts';
import type { FolderEntry } from '#cli/types/checks/general.ts';
import type { CheckInput } from '#cli/types/checks/run/check.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { INSTALLED_DEPENDENCY_FOLDERS } from '#cli/config/repository/tracked.ts';
import { isInGspotFolder, listTaggedExtensions } from '#cli/repository/classify.ts';

/**
 * Lists the source files that the folder checks read: no Markdown, and nothing under .gspot.
 * @param input the scope files.
 * @returns the code files.
 */
export function listCodeFiles(input: CheckInput): TrackedFile[] {
    const documents = listTaggedExtensions('markdown');
    return input.files.filter(
        (file) =>
            file.kind === 'source' &&
            !isInGspotFolder(file.path) &&
            documents.every((extension) => !file.path.endsWith(extension)),
    );
}

/**
 * Checks whether a path lies inside an installed dependency folder.
 * @param folder the repository-relative path.
 * @returns whether a dependency folder holds it.
 */
export function isDependencyFolder(folder: string): boolean {
    return folder.split('/').some((segment) => INSTALLED_DEPENDENCY_FOLDERS.has(segment));
}

/**
 * Maps each folder to its files and child folders, from the tracked files.
 * @param files the tracked paths.
 * @returns each folder path with its files and child folders, sorted by name.
 */
export function buildFolderTree(files: readonly { path: string }[]): Map<string, FolderEntry[]> {
    const tree = new Map<string, Map<string, FolderEntry['kind']>>();
    const addEntry = (folder: string, name: string, kind: FolderEntry['kind']): void => {
        const entries = tree.get(folder) ?? new Map<string, FolderEntry['kind']>();
        entries.set(name, kind);
        tree.set(folder, entries);
    };
    for (const file of files) {
        const segments = file.path.split('/');
        const name = segments.pop();
        if (name === undefined) continue;
        for (const [depth, segment] of segments.entries())
            addEntry(segments.slice(0, depth).join('/'), segment, 'folder');
        addEntry(extractParentFolder(file.path), name, 'file');
    }
    return new Map(
        [...tree].map(([folder, entries]) => [
            folder,
            [...entries].map(([name, kind]) => ({ name, kind })).toSorted((a, b) => a.name.localeCompare(b.name)),
        ]),
    );
}
