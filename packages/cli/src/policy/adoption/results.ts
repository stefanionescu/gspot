import { CARRIED_REASON } from '#cli/policy/reasons.ts';
import { asList } from '#cli/policy/adoption/source.ts';
import type { TomlTable } from '#cli/types/repository/repository.ts';
import type { CarriedConfiguration, CarriedIgnore } from '#cli/types/policy/adoption.ts';

/**
 * The reason written on every entry carried from one authored file.
 * @param file the authored file
 * @returns the reason
 */
export function reasonFor(file: string): string {
    return CARRIED_REASON.replaceAll('{{file}}', () => file);
}

/**
 * Appends entries to a list setting of a carried tool; nothing is written for an empty list.
 * @param lists the carried configuration
 * @param tool the tool name
 * @param key the setting key under the tool
 * @param entries the entries to append
 */
export function appendSetting(lists: CarriedConfiguration, tool: string, key: string, entries: unknown[]): void {
    if (entries.length === 0) return;
    const settings = carriedTool(lists, tool).settings;
    settings[key] = [...asList(settings[key]), ...entries];
}

/**
 * The entries owned by one adopted tool, shared by readers, policy emission, and the plan.
 * @param lists the carried configuration
 * @param tool the tool name
 * @returns the tool's settings and ignores, created on first use
 */
export function carriedTool(
    lists: CarriedConfiguration,
    tool: string,
): { settings: TomlTable; ignores: CarriedIgnore[] } {
    const entry = lists.tools.get(tool) ?? { settings: {}, ignores: [] };
    lists.tools.set(tool, entry);
    return entry;
}
