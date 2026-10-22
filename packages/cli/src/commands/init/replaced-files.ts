import { openFiles } from '#cli/system/files/open.ts';
import type { ManagedKeys } from '#cli/types/ownership.ts';
import type { ReplacedFiles } from '#cli/types/commands/init.ts';
import { isEditedInPlace } from '#cli/repository/existing-tools.ts';
import type { ReplacedFile, ExistingTools } from '#cli/types/repository/existing-tools.ts';

// Record what init does with one file: a shared file stays for you, and init deletes an owned one.
function addReplacedFile(entry: ReplacedFile, replaced: ReplacedFiles): void {
    const { tool, path, shared } = entry;
    if (shared)
        replaced.retained.push({
            path,
            note: `${entry.table ?? entry.key ?? entry.tool} settings stay here, and the generated ${tool} config file takes over. Delete the section; the generated config file replaces it.`,
        });
    else replaced.deleted.push({ path, note: `replaced by the generated ${tool} config file` });
}

/**
 * Read the config files of the chosen tools, and sort them into the files init deletes and the files it keeps.
 *
 * @param root the folder where init reads the originals before it replaces them.
 * @param existingTools the config files that init found.
 * @param tools what the checks at this level run.
 * @param fileEdits the shared config file edits for these configurations.
 * @returns the reads, the deletions, and the shared files that stay.
 */
export function readReplacedFiles(
    root: string,
    existingTools: ExistingTools,
    tools: Set<string>,
    fileEdits: ManagedKeys[],
): ReplacedFiles {
    const replaced: ReplacedFiles = { read: new Map(), deleted: [], retained: [], changed: [] };
    const owned = existingTools.replacedFiles.filter(({ tool }) => tools.has(tool));
    using files = openFiles(root);
    for (const path of new Set(owned.filter((entry) => !entry.shared).map((entry) => entry.path))) {
        replaced.read.set(path, files.read(path));
    }
    for (const output of fileEdits) {
        replaced.read.set(output.path, files.read(output.path));
        replaced.changed.push({
            path: output.path,
            note: `managed ${output.keys.map((field) => field.key.join('.')).join(', ')} fields; other content stays`,
        });
    }
    for (const entry of owned) {
        if (entry.shared && isEditedInPlace(entry, fileEdits)) continue;
        addReplacedFile(entry, replaced);
    }
    return replaced;
}
