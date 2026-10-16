import { extractParentFolder } from '#cli/system/paths.ts';
import type { FolderEntry } from '#cli/types/checks/general.ts';
import type { CheckInput } from '#cli/types/checks/run/check.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { INSTALLED_DEPENDENCY_FOLDERS } from '#cli/config/repository/tracked.ts';
import { isInGspotFolder, listTaggedExtensions } from '#cli/repository/classify.ts';

/**
 * The code files the folder checks look at: no Markdown and nothing under .gspot.
 * @param input the selected repository files.
 * @returns source entries outside Markdown documents and the generated gspot folder.
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
 * Identify dependency directories that tools own.
 * @param folder the repository-relative directory.
 * @returns whether a dependency folder contains the directory.
 */
export function isDependencyFolder(folder: string): boolean {
    return folder.split('/').some((segment) => INSTALLED_DEPENDENCY_FOLDERS.has(segment));
}

/**
 * The entries every directory holds, from the tracked files: files and the child directories they imply.
 * @param files the tracked files.
 * @returns directory path to its entries, sorted by name.
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
