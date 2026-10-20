import { extractParentFolder } from '#cli/system/paths.ts';
import type { CheckInput } from '#cli/types/runs/check.ts';
import type { FolderEntry } from '#cli/types/checks/structure.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { isInGspotFolder, listTaggedExtensions } from '#cli/repository/classify.ts';

/**
 * Lists the source files that the folder checks read: no Markdown, and nothing under .gspot.
 *
 * @param input the scope files.
 * @returns the scope files without Markdown or .gspot files.
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
 * Maps each folder to its files and child folders, from the tracked files.
 *
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
