import { GspotError } from '#cli/system/errors.ts';
import { runGitBlocking } from '#cli/system/git.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { isEditedInPlace } from '#cli/repository/setup.ts';
import type { ManagedKeys } from '#cli/types/repository/writer.ts';
import type { ConflictingConfigFiles } from '#cli/types/commands/init.ts';
import { parsePrettierFile } from '#cli/commands/init/formatter-settings.ts';
import type { RepositorySetup, ConflictingConfigFile } from '#cli/types/repository/setup.ts';

import {
    VERIFY_FLAG,
    NAME_ONLY_FLAG,
    PRETTIER_SCRIPT_NOTE,
    READ_COMMITTED_MESSAGE,
} from '#cli/config/commands/init/conflicting-config-files.ts';

/**
List config files whose working copies match their committed contents.

@param root the repository folder.
@param paths the config files init replaces.
@returns none without a commit.
*/
export function listCommittedPaths(root: string, paths: string[]): Set<string> {
    const head = runGitBlocking(root, ['rev-parse', VERIFY_FLAG, '--quiet', 'HEAD']);
    if (head.code !== 0) return new Set();
    const tracked = runGitBlocking(root, ['ls-files', '-z', '--', ...paths]);
    const changed = runGitBlocking(root, ['diff', NAME_ONLY_FLAG, '-z', 'HEAD', '--', ...paths]);
    if (tracked.code !== 0 || changed.code !== 0) throw new GspotError('git', READ_COMMITTED_MESSAGE);
    const modified = new Set(changed.stdout.split('\0'));
    return new Set(tracked.stdout.split('\0').filter((path) => path !== '' && !modified.has(path)));
}

function addConflictingConfigFile(file: ConflictingConfigFile, conflicts: ConflictingConfigFiles): void {
    const { tool, path, shared } = file;
    if (shared)
        conflicts.kept.push({
            path,
            note: `${file.table ?? file.key ?? file.tool} settings stay here, and the generated ${tool} config file takes over. Delete the section; the generated config file replaces it.`,
        });
    else
        conflicts.deleted.push({
            path,
            note: `replaced by the generated ${tool} config file${tool === 'prettier' && parsePrettierFile(path, conflicts.reviewed.get(path)?.bytes.toString('utf8') ?? '') === undefined ? PRETTIER_SCRIPT_NOTE : ''}`,
        });
}

/**
Read the config files of the chosen tools, and sort them into the files init deletes and the files it keeps.

@param root the folder where init reads the originals before it replaces them.
@param repositorySetup the config files that init found.
@param tools what the checks at this level run.
@param managedKeys the shared config file edits for these configurations.
*/
export function readConflictingConfigFiles(
    root: string,
    repositorySetup: RepositorySetup,
    tools: Set<string>,
    managedKeys: ManagedKeys[],
): ConflictingConfigFiles {
    const conflicts: ConflictingConfigFiles = { reviewed: new Map(), deleted: [], kept: [], changed: [] };
    const owned = repositorySetup.conflictingConfigFiles.filter(({ tool }) => tools.has(tool));
    const files = openFiles(root);
    const paths = new Set(owned.filter((file) => !file.shared).map((file) => file.path));
    for (const path of paths) {
        conflicts.reviewed.set(path, files.read(path));
    }
    for (const edit of managedKeys) {
        conflicts.reviewed.set(edit.path, files.read(edit.path));
        conflicts.changed.push({
            path: edit.path,
            note: `managed ${edit.keys.map((field) => field.key.join('.')).join(', ')} fields; other content stays`,
        });
    }
    for (const file of owned) {
        if (file.shared && isEditedInPlace(file, managedKeys)) continue;
        addConflictingConfigFile(file, conflicts);
    }
    return conflicts;
}
