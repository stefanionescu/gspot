import { openFiles } from '#cli/system/files/open.ts';
import type { ManagedKeys } from '#cli/types/apply.ts';
import { isEditedInPlace } from '#cli/repository/setup/tools.ts';
import type { ConflictingConfigFiles } from '#cli/types/commands/init.ts';
import type { RepositorySetup, ConflictingConfigFile } from '#cli/types/repository/setup.ts';

function addConflictingConfigFile(file: ConflictingConfigFile, conflicts: ConflictingConfigFiles): void {
    const { tool, path, shared } = file;
    if (shared)
        conflicts.retained.push({
            path,
            note: `${file.table ?? file.key ?? file.tool} settings stay here, and the generated ${tool} config file takes over. Delete the section; the generated config file replaces it.`,
        });
    else conflicts.deleted.push({ path, note: `replaced by the generated ${tool} config file` });
}

/**
 * Read the config files of the chosen tools, and sort them into the files init deletes and the files it keeps.
 *
 * @param root the folder where init reads the originals before it replaces them.
 * @param repositorySetup the config files that init found.
 * @param tools what the checks at this level run.
 * @param fileEdits the shared config file edits for these configurations.
 * @returns the reads, the deletions, and the shared files that stay.
 */
export function readConflictingConfigFiles(
    root: string,
    repositorySetup: RepositorySetup,
    tools: Set<string>,
    fileEdits: ManagedKeys[],
): ConflictingConfigFiles {
    const conflicts: ConflictingConfigFiles = { read: new Map(), deleted: [], retained: [], changed: [] };
    const owned = repositorySetup.conflictingConfigFiles.filter(({ tool }) => tools.has(tool));
    using files = openFiles(root);
    for (const path of new Set(owned.filter((file) => !file.shared).map((file) => file.path))) {
        conflicts.read.set(path, files.read(path));
    }
    for (const output of fileEdits) {
        conflicts.read.set(output.path, files.read(output.path));
        conflicts.changed.push({
            path: output.path,
            note: `managed ${output.keys.map((field) => field.key.join('.')).join(', ')} fields; other content stays`,
        });
    }
    for (const file of owned) {
        if (file.shared && isEditedInPlace(file, fileEdits)) continue;
        addConflictingConfigFile(file, conflicts);
    }
    return conflicts;
}
