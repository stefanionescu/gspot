// What init replaces: the configuration files of the selected tools, read before anything is written.
import { openRoot } from '#cli/platform/root/open.ts';
import type { Replaced } from '#cli/types/commands/init.ts';
import { isReplaced } from '#cli/configurations/takeover.ts';
import type { Tooling, ToolFile } from '#cli/types/repository/inventory.ts';

// Captures files selected for removal. Retained authored content has no mutation snapshot.
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
    if (shared === true)
        replaced.retained.push({
            path,
            note: `${table ?? key ?? tool} settings stay here, and the generated ${tool} configuration takes over. Delete the section when ready.`,
        });
    else replaced.removed.push({ path, note: `replaced by the generated ${tool} configuration` });
}

/**
 * The configuration files of the selected tools, read and sorted into what init deletes and what it leaves.
 * @param root the repository root
 * @param tooling the configuration files init found
 * @param selected the ids of the selected configurations
 * @returns the reads, the deletions, the unreadable files, and the shared files that stay
 */
export function getReplaced(root: string, tooling: Tooling, selected: Set<string>): Replaced {
    const replaced: Replaced = { read: new Map(), removed: [], unread: [], retained: [] };
    const owned = tooling.configs.filter(({ tool }) => isReplaced(tool, selected));
    captureOwned(
        root,
        owned.filter((entry) => entry.shared !== true),
        replaced,
    );
    for (const entry of owned) {
        if (entry.shared === true || replaced.read.has(entry.path)) recordOutcome(entry, replaced);
    }
    return replaced;
}
