import { compareText } from '#cli/system/text.ts';
import { extractParentFolder } from '#cli/system/paths.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { TrackedFile } from '#cli/types/repository/files.ts';
import { listTaggedExtensions } from '#cli/repository/files/classify.ts';
import type { FolderChild } from '#cli/types/checks/general/structure.ts';

/**
Lists the source files that the folder checks read: no Markdown.

@param planned the scope files.
@returns the source files without Markdown.
*/
export function listCodeFiles(planned: PlannedCheck): TrackedFile[] {
    const documents = listTaggedExtensions('markdown');
    return planned.files.filter(
        (file) => file.kind === 'source' && documents.every((extension) => !file.path.endsWith(extension)),
    );
}

/**
Maps each folder to its files and child folders, from the tracked files.

@param files the tracked paths.
@returns each folder path with its files and child folders, sorted by name.
*/
export function buildFolderTree(files: readonly { path: string }[]): Map<string, FolderChild[]> {
    const tree = new Map<string, Map<string, FolderChild['kind']>>();
    const addChild = (folder: string, name: string, kind: FolderChild['kind']): void => {
        const children = tree.get(folder) ?? new Map<string, FolderChild['kind']>();
        children.set(name, kind);
        tree.set(folder, children);
    };
    for (const file of files) {
        const segments = file.path.split('/');
        const name = segments.pop();
        if (name === undefined) continue;
        for (const [depth, segment] of segments.entries())
            addChild(segments.slice(0, depth).join('/'), segment, 'folder');
        addChild(extractParentFolder(file.path), name, 'file');
    }
    return new Map(
        [...tree].map(([folder, children]) => [
            folder,
            [...children].map(([name, kind]) => ({ name, kind })).toSorted((a, b) => compareText(a.name, b.name)),
        ]),
    );
}
