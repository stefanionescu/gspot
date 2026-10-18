// Find the tool files that init replaces, and read them before init writes anything.
import { openFiles } from '#cli/system/files/open.ts';
import type { FileEdit } from '#cli/types/ownership.ts';
import type { ReplacedFiles } from '#cli/types/commands/init.ts';
import type { ExistingTools, FoundToolFile } from '#cli/types/repository/inventory.ts';

// Record what init does with one file: a shared file stays for you, and init deletes an owned one.
function recordReplacedFile(entry: FoundToolFile, replaced: ReplacedFiles): void {
    const { tool, path, shared, table, key } = entry;
    if (shared)
        replaced.retained.push({
            path,
            note: `${table ?? key ?? tool} settings stay here, and the generated ${tool} tool file takes over. Delete the section when ready.`,
        });
    else replaced.deleted.push({ path, note: `replaced by the generated ${tool} tool file` });
}

/**
 * Read the tool files of the chosen tools, and sort them into the files init deletes and the files it keeps.
 * @param repositoryRoot the folder where init reads the originals before it replaces them.
 * @param existingTools the tool files that init found.
 * @param tools what the checks at this level run.
 * @param toolFiles the shared tool file edits for this selection.
 * @returns the reads, the deletions, and the shared files that stay.
 */
export function planReplacedFiles(
    repositoryRoot: string,
    existingTools: ExistingTools,
    tools: Set<string>,
    toolFiles: FileEdit[],
): ReplacedFiles {
    const replaced: ReplacedFiles = { read: new Map(), deleted: [], retained: [], changed: [] };
    const owned = existingTools.toolFiles.filter(({ tool }) => tools.has(tool));
    using files = openFiles(repositoryRoot);
    for (const path of new Set(owned.filter((entry) => !entry.shared).map((entry) => entry.path))) {
        replaced.read.set(path, files.read(path));
    }
    for (const output of toolFiles) {
        replaced.read.set(output.path, files.read(output.path));
        replaced.changed.push({
            path: output.path,
            note: `managed ${output.changes.map((field) => field.path.join('.')).join(', ')} fields; other content stays`,
        });
    }
    for (const entry of owned) {
        if (
            entry.shared &&
            toolFiles.some(
                (output) => output.path === entry.path && output.changes.some((field) => field.path[0] === entry.key),
            )
        )
            continue;
        if (entry.shared || replaced.read.has(entry.path)) recordReplacedFile(entry, replaced);
    }
    return replaced;
}
