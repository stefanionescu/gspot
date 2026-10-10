// What init replaces: the tool files of the selected tools, read before anything is written.
import { openRoot } from '#cli/platform/root/public.ts';
import type { Replaced } from '#cli/types/commands/init.ts';
import type { EmittedToolFile } from '#cli/types/generation/files.ts';
import type { Tooling, ToolFile } from '#cli/types/repository/inventory.ts';

// Captures files selected for removal. Retained authored content has no mutation copy.
function captureOwned(root: string, owned: ToolFile[], replaced: Replaced): void {
    using files = openRoot(root);
    for (const path of new Set(owned.map((entry) => entry.path))) {
        const original = files.read(path);
        if (original === undefined)
            replaced.unread.push({ path, note: 'not read and not deleted: the file is missing' });
        else replaced.read.set(path, original);
    }
}

// Records what init does with one file: a shared file stays for the developer, an owned one is deleted.
function recordOutcome(entry: ToolFile, replaced: Replaced): void {
    const { tool, path, shared, table, key } = entry;
    if (shared)
        replaced.retained.push({
            path,
            note: `${table ?? key ?? tool} settings stay here, and the generated ${tool} tool file takes over. Delete the section when ready.`,
        });
    else replaced.removed.push({ path, note: `replaced by the generated ${tool} tool file` });
}

/**
 * The tool files of the selected tools, read and sorted into what init deletes and what it leaves.
 * @param root the repository root.
 * @param tooling the tool files init found.
 * @param tools the tools consumed by applicable checks at the selected level.
 * @param toolFiles the applicable shared fields generated for the selection.
 * @returns the reads, the deletions, the unreadable files, and the shared files that stay.
 */
export function planTakeover(
    root: string,
    tooling: Tooling,
    tools: Set<string>,
    toolFiles: EmittedToolFile[],
): Replaced {
    const replaced: Replaced = { read: new Map(), removed: [], unread: [], retained: [], changed: [] };
    const owned = tooling.toolFiles.filter(({ tool }) => tools.has(tool));
    captureOwned(
        root,
        owned.filter((entry) => !entry.shared),
        replaced,
    );
    using files = openRoot(root);
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
