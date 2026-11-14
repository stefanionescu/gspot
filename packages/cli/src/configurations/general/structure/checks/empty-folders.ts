import { readdirSync } from 'node:fs';
import { join, posix } from 'node:path';
import { readGitPaths } from '#cli/repository/git/run.ts';
import { extractParentFolder, listEnclosingFolders } from '#cli/system/paths.ts';
import type { CheckCode, CheckFinding, CheckSession } from '#cli/types/engine/run.ts';

import {
    EMPTY_FOLDER_RULE,
    PLACEHOLDER_FILES,
    NO_EMPTY_FOLDERS_FLAG,
    UNTRACKED_FOLDERS_ARGUMENTS,
} from '#cli/config/configurations/structure.ts';

async function listEmptyFolders({ toolsRoot, cancelSignal }: CheckSession): Promise<CheckFinding[]> {
    const options = { cancelSignal };
    const untracked = await readGitPaths(toolsRoot, UNTRACKED_FOLDERS_ARGUMENTS, options);
    const holding = new Set(
        await readGitPaths(toolsRoot, [...UNTRACKED_FOLDERS_ARGUMENTS, NO_EMPTY_FOLDERS_FLAG], options),
    );
    return untracked
        .filter(
            (path) =>
                path.endsWith('/') &&
                !holding.has(path) &&
                readdirSync(join(toolsRoot, path), { recursive: true, withFileTypes: true }).every((entry) =>
                    entry.isDirectory(),
                ),
        )
        .map((path) => ({
            file: path.slice(0, -1),
            rule: EMPTY_FOLDER_RULE,
            message: `The folder ${path} holds no files.`,
        }));
}

function isPlaceholder(path: string): boolean {
    return PLACEHOLDER_FILES.has(posix.basename(path));
}

function listPlaceholderFolders({ repository, selection }: CheckSession): CheckFinding[] {
    const paths = repository.files.map(({ path }) => path);
    const holding = new Set(
        paths.filter((path) => !isPlaceholder(path)).flatMap((path) => listEnclosingFolders(extractParentFolder(path))),
    );
    const placeholders = paths.filter(
        (path) => isPlaceholder(path) && (selection?.paths === undefined || selection.paths.includes(path)),
    );
    return placeholders.flatMap((path) => {
        const top = listEnclosingFolders(extractParentFolder(path)).findLast((folder) => !holding.has(folder));
        if (top === undefined) return [];
        return [
            {
                file: path,
                rule: EMPTY_FOLDER_RULE,
                message: `The folder ${top}/ holds only ${posix.basename(path)}.`,
            },
        ];
    });
}

// Git keeps no empty folder, so the search reads the working tree. A folder that a placeholder file keeps in Git reports
// on that file, so that it fails a commit only when the commit touches it.
export const STRUCTURE_EMPTY_FOLDERS_CHECKS: Readonly<Record<string, CheckCode>> = {
    'structure/empty-folders': {
        check: async (session) => [...(await listEmptyFolders(session)), ...listPlaceholderFolders(session)],
    },
};
