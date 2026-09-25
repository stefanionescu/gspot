import type { FileSnapshot } from '#cli/platform/filesystem.ts';
import { asList } from '#cli/policy/adoption/source.ts';
import type { Policy } from '#cli/policy/normalize.ts';
import { CARRIED_REASON } from '#cli/policy/reasons.ts';
import type { RawPolicy } from '#cli/policy/schema.ts';
import type { TomlTable } from '#cli/repository/configuration-section.ts';

export function reasonFor(file: string): string {
    return CARRIED_REASON.replaceAll('{{file}}', () => file);
}

export function appendSetting(lists: CarriedConfiguration, tool: string, key: string, entries: unknown[]): void {
    if (entries.length === 0) return;
    const settings = carriedTool(lists, tool).settings;
    settings[key] = [...asList(settings[key]), ...entries];
}

/**
 * The entries owned by one adopted tool, shared by readers, policy emission, and the plan.
 * @param lists
 * @param tool
 */
export function carriedTool(
    lists: CarriedConfiguration,
    tool: string,
): { settings: TomlTable; ignores: CarriedIgnore[] } {
    const entry = lists.tools.get(tool) ?? { settings: {}, ignores: [] };
    lists.tools.set(tool, entry);
    return entry;
}

export type CarriedIgnore = { check: string; rule?: string; reason: string; paths?: string[] };

export type CarriedFormatter = {
    format: Policy['format'];
    extra?: TomlTable;
    ignorePatterns?: string[];
    nativeDefaults?: boolean;
    editorconfig?: NonNullable<NonNullable<RawPolicy['tools']>['editorconfig']>['adopted'];
};

export type CarriedLists = Map<string, { settings: TomlTable; ignores: CarriedIgnore[] }>;

export type CarriedConfiguration = {
    tools: CarriedLists;
    scopes: Map<string, { configurations: string[]; tools: Record<string, TomlTable> }>;
    formatter?: CarriedFormatter;
    observed: Map<string, FileSnapshot>;
    removed: { path: string; note: string }[];
    unread: { path: string; note: string }[];
    retained: { path: string; note: string }[];
};

export type CarryPush = (rule: string, paths?: string[]) => void;
