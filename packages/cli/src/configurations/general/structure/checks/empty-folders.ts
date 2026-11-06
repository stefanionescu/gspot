import { readdirSync } from 'node:fs';
import { join, posix } from 'node:path';

import { readGitPaths } from '#cli/repository/git/run.ts';
import { extractParentFolder, listEnclosingFolders } from '#cli/system/paths.ts';
import type { CheckCode, CheckSession } from '#cli/types/engine/run.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';

const EMPTY_FOLDER_RULE = 'empty-folder';

const PLACEHOLDER_FILES: ReadonlySet<string> = new Set(['.gitkeep', '.keep']);

// Git lists a folder with untracked files under both forms of this command, and an empty one only without the flag.
const UNTRACKED_FOLDERS_ARGUMENTS = ['ls-files', '--others', '--directory', '--exclude-standard', '-z'] as const;

const NO_EMPTY_FOLDERS_FLAG = '--no-empty-directory';

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
