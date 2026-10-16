// What init replaces: the tool files of the selected tools, read before init writes anything.
import type { FileEdit } from '#cli/types/ownership.ts';
import { openSafeFolder } from '#cli/system/files/open.ts';
import type { ReplacedFiles } from '#cli/types/commands/init.ts';
import type { Tooling, FoundToolFile } from '#cli/types/repository/inventory.ts';

// Records what init does with one file: a shared file stays for the developer, and init deletes an owned one.
function recordOutcome(entry: FoundToolFile, replaced: ReplacedFiles): void {
    const { tool, path, shared, table, key } = entry;
    if (shared)
        replaced.retained.push({
            path,
            note: `${table ?? key ?? tool} settings stay here, and the generated ${tool} tool file takes over. Delete the section when ready.`,
        });
    else replaced.deleted.push({ path, note: `replaced by the generated ${tool} tool file` });
}

/**
 * The tool files of the selected tools, read and sorted into what init deletes and what it leaves.
 * @param root the repository root.
 * @param tooling the tool files init found.
 * @param tools the tools consumed by applicable checks at the selected level.
 * @param toolFiles the applicable shared fields generated for the selection.
 * @returns the reads, the deletions, the shared files that stay.
 */
export function planReplacedFiles(
    root: string,
    tooling: Tooling,
    tools: Set<string>,
    toolFiles: FileEdit[],
): ReplacedFiles {
    const replaced: ReplacedFiles = { read: new Map(), deleted: [], retained: [], changed: [] };
    const owned = tooling.toolFiles.filter(({ tool }) => tools.has(tool));
    using files = openSafeFolder(root);
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
        if (entry.shared || replaced.read.has(entry.path)) recordOutcome(entry, replaced);
    }
    return replaced;
}
