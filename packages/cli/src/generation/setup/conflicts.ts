import { GspotError } from '#cli/system/errors.ts';
import { runGit } from '#cli/repository/git/run.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { writePlans } from '#cli/repository/writer.ts';
import { isSameContents } from '#cli/system/files/bounded.ts';
import { isEditedInPlace } from '#cli/repository/conflicts.ts';
import type { Files, FileContents } from '#cli/types/system.ts';
import { parsePrettierFile } from '#cli/generation/setup/format.ts';
import type { WritePlan, RepositorySetup, ConflictingConfig } from '#cli/types/repository.ts';
import type { InitPlan, ConflictSearch, PrettierScripts, ConflictingConfigs } from '#cli/types/generation.ts';
import { VERIFY_FLAG, NAME_ONLY_FLAG, DROPPED_LINE_SETTINGS, READ_COMMITTED_MESSAGE } from '#cli/config/generation.ts';

async function listCommittedPaths(root: string, paths: string[]): Promise<Set<string>> {
    const head = await runGit(root, ['rev-parse', VERIFY_FLAG, '--quiet', 'HEAD'], {});
    if (head.code !== 0) return new Set();
    const [tracked, changed] = await Promise.all([
        runGit(root, ['ls-files', '-z', '--', ...paths], {}),
        runGit(root, ['diff', NAME_ONLY_FLAG, '-z', 'HEAD', '--', ...paths], {}),
    ]);
    if (tracked.code !== 0 || changed.code !== 0) throw new GspotError('git', READ_COMMITTED_MESSAGE);
    const modified = new Set(changed.stdout.split('\0'));
    return new Set(tracked.stdout.split('\0').filter((path) => path !== '' && !modified.has(path)));
}

function addConflictingConfig(
    file: ConflictingConfig,
    conflicts: ConflictingConfigs,
    prettierScripts: PrettierScripts,
): void {
    const { tool, path, shared } = file;
    if (shared) {
        conflicts.kept.push({
            path,
            note: `${file.table ?? file.key ?? file.tool} settings stay here, and the generated file for ${tool} takes over. Delete the section; the generated file replaces it.`,
        });
        return;
    }
    const text = conflicts.reviewed.get(path)?.bytes.toString('utf8') ?? '';
    conflicts.deleted.push({
        path,
        tool,
        unreadablePrettier: tool === 'prettier' && parsePrettierFile(path, text, prettierScripts) === undefined,
        dropsLineEndings: DROPPED_LINE_SETTINGS.test(text),
    });
}

/**
Read the config files of the chosen tools, and sort them into the files init deletes and the files it keeps.

@param root the folder where init reads the originals before it replaces them.
@param repositorySetup the config files that init found.
@param search what to read.
@param search.tools what the checks at this level run.
@param search.managedKeys the shared config file edits for these configurations.
@param search.prettierScripts the options of the JavaScript Prettier configs.
*/
export function readConflictingConfigs(
    root: string,
    repositorySetup: RepositorySetup,
    { tools, managedKeys, prettierScripts }: ConflictSearch,
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
        addConflictingConfig(file, conflicts, prettierScripts);
    }
    return conflicts;
}

/**
Refuse to replace a config file unless Git holds it unchanged in the last commit, so that the user can restore it.

@param root the repository folder.
@param paths the config files init deletes.
*/
export async function assertFilesCommitted(root: string, paths: string[]): Promise<void> {
    const committed = await listCommittedPaths(root, paths);
    const uncommitted = paths.filter((path) => !committed.has(path));
    if (uncommitted.length === 0) return;
    const pronoun = uncommitted.length === 1 ? 'it' : 'them';
    throw new GspotError(
        'arguments',
        `init replaces ${uncommitted.join(', ')}, and Git does not hold ${pronoun} unchanged at HEAD. Commit ${pronoun} or move ${pronoun} away, then run gspot init again.`,
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
    deleted: InitPlan['deleted'],
    reviewed: ReadonlyMap<string, FileContents | undefined>,
): string[] {
    const kept: string[] = [];
    const plans: WritePlan[] = [];
    for (const file of deleted) {
        const previous = reviewed.get(file.path);
        if (previous === undefined || !isSameContents(writer.read(file.path), previous)) kept.push(file.path);
        else plans.push({ path: file.path, status: 'changed' });
    }
    writePlans(writer, plans);
    return kept;
}
