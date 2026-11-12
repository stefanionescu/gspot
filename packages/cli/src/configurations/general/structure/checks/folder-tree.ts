import { extractParentFolder } from '#cli/system/paths.ts';
import { compareText } from '#cli/system/text.ts';
import type { FolderChild } from '#cli/types/configurations/general.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { TrackedFile } from '#cli/types/repository.ts';

export function listCodeFiles(planned: PlannedCheck): TrackedFile[] {
    return planned.files.filter((file) => file.kind === 'source' && !file.tags.includes('markdown'));
}

export function buildFolderTree(files: ReadonlyArray<{ path: string }>): Map<string, FolderChild[]> {
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
