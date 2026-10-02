// What init replaces: the configuration files of the selected tools, read before anything is written.
import { isOwned } from '#cli/kits/takeover.ts';
import { openRoot } from '#cli/platform/filesystem.ts';
import type { Replaced } from '#cli/types/commands/init.ts';
import type { ExistingTool, ExistingTooling } from '#cli/types/repository/repository.ts';

// Captures every owned file. The write refuses a file that changed after the plan was shown.
function readOwned(root: string, owned: ExistingTool[], replaced: Replaced): void {
    using files = openRoot(root);
    for (const path of new Set(owned.map((entry) => entry.path))) {
        const original = files.read(path);
        if (original === undefined)
            replaced.unread.push({ path, note: 'not read and not deleted: the file is missing' });
        else replaced.read.set(path, original);
    }
}

// Records what init does with one file: a shared file stays for the developer, an owned one is deleted.
function recordOutcome(entry: ExistingTool, replaced: Replaced): void {
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
 * @param selected the ids of the selected kits
 * @returns the reads, the deletions, the unreadable files, and the shared files that stay
 */
export function replacedConfiguration(root: string, tooling: ExistingTooling, selected: Set<string>): Replaced {
    const replaced: Replaced = { read: new Map(), removed: [], unread: [], retained: [] };
    const owned = tooling.configs.filter(({ tool }) => isOwned(tool, selected));
    readOwned(root, owned, replaced);
    for (const entry of owned) if (replaced.read.has(entry.path)) recordOutcome(entry, replaced);
    return replaced;
}
