import { GspotError } from '#cli/system/errors.ts';
import { runGitBlocking } from '#cli/system/git.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { writePlans } from '#cli/repository/writer.ts';
import { isEditedInPlace } from '#cli/repository/conflicts.ts';
import type { Files, FileContents } from '#cli/types/system/files.ts';
import { parsePrettierFile } from '#cli/commands/init/formatter-settings.ts';
import type { InitPlan, ConflictingConfigs } from '#cli/types/commands/init.ts';
import type { WritePlan, ManagedKeys, RepositorySetup, ConflictingConfig } from '#cli/types/repository/repository.ts';

import {
    VERIFY_FLAG,
    NAME_ONLY_FLAG,
    PRETTIER_SCRIPT_NOTE,
    READ_COMMITTED_MESSAGE,
} from '#cli/config/commands/init.ts';

function listCommittedPaths(root: string, paths: string[]): Set<string> {
    const head = runGitBlocking(root, ['rev-parse', VERIFY_FLAG, '--quiet', 'HEAD']);
    if (head.code !== 0) return new Set();
    const tracked = runGitBlocking(root, ['ls-files', '-z', '--', ...paths]);
    const changed = runGitBlocking(root, ['diff', NAME_ONLY_FLAG, '-z', 'HEAD', '--', ...paths]);
    if (tracked.code !== 0 || changed.code !== 0) throw new GspotError('git', READ_COMMITTED_MESSAGE);
    const modified = new Set(changed.stdout.split('\0'));
    return new Set(tracked.stdout.split('\0').filter((path) => path !== '' && !modified.has(path)));
}

function addConflictingConfig(file: ConflictingConfig, conflicts: ConflictingConfigs): void {
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
export function readConflictingConfigs(
    root: string,
    repositorySetup: RepositorySetup,
    tools: Set<string>,
    managedKeys: ManagedKeys[],
): ConflictingConfigs {
    const conflicts: ConflictingConfigs = { reviewed: new Map(), deleted: [], kept: [], changed: [] };
    const owned = repositorySetup.conflictingConfigs.filter(({ tool }) => tools.has(tool));
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
        addConflictingConfig(file, conflicts);
    }
    return conflicts;
}

/**
Refuse to replace a config file unless Git holds it unchanged in the last commit, so that the user can restore it.

@param root the repository folder.
@param paths the config files init deletes.
*/
export function assertFilesCommitted(root: string, paths: string[]): void {
    const committed = listCommittedPaths(root, paths);
    const uncommitted = paths.filter((path) => !committed.has(path));
    if (uncommitted.length > 0)
        throw new GspotError(
            'arguments',
            `init replaces ${uncommitted.join(', ')}, and Git does not hold them unchanged at HEAD. Commit them or move them away, then run gspot init again.`,
        );
}

/**
Delete the config files that init replaces, and keep each one that changed after init read it.

@param writer the repository writer.
@param deleted the config files that the plan deletes.
@param reviewed the contents init read before it showed the plan.
@returns the paths that init kept.
*/
export function deleteConflictingConfigs(
    writer: Files,
    deleted: InitPlan['delete'],
    reviewed: ReadonlyMap<string, FileContents | undefined>,
): string[] {
    const kept: string[] = [];
    const plans: WritePlan[] = [];
    for (const file of deleted) {
        if (reviewed.get(file.path) === undefined) kept.push(file.path);
        else plans.push({ path: file.path, status: 'changed' });
    }
    writePlans(writer, plans);
    return kept;
}
