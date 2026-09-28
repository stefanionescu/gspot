import { asList } from '#cli/policy/adoption/source.ts';
import { CARRIED_REASON } from '#cli/config/policy/policy.ts';
import type { TomlTable } from '#cli/types/repository/repository.ts';
import type { AdoptedScope, AdoptedIgnore, AdoptionResult } from '#cli/types/policy/adoption.ts';

/**
 * The reason written on every entry carried from one authored file.
 * @param file the authored file
 * @returns the reason
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The reason written on every entry carried from one authored file. 7 files make 9 calls; one owner keeps that behavior in one place.
export function reasonFor(file: string): string {
    return CARRIED_REASON.replaceAll('{{file}}', () => file);
}

/**
 * Appends entries to a list setting of an adopted tool; nothing is written for an empty list.
 * @param adoption the adopted configuration
 * @param tool the tool name
 * @param key the setting key under the tool
 * @param entries the entries to append
 */
export function appendSetting(adoption: AdoptionResult, tool: string, key: string, entries: unknown[]): void {
    if (entries.length === 0) return;
    const settings = adoptedTool(adoption, tool).settings;
    settings[key] = [...asList(settings[key]), ...entries];
}

/**
 * The entries owned by one adopted tool, shared by readers, policy emission, and the plan.
 * @param adoption the adopted configuration
 * @param tool the tool name
 * @returns the tool's settings and ignores, created on first use
 */
export function adoptedTool(adoption: AdoptionResult, tool: string): { settings: TomlTable; ignores: AdoptedIgnore[] } {
    const entry = adoption.tools.get(tool) ?? { settings: {}, ignores: [] };
    adoption.tools.set(tool, entry);
    return entry;
}

/**
 * Select a configuration for a nested scope while preserving adopted settings.
 * @param adoption the configuration being adopted
 * @param path the repository-relative scope directory
 * @param configuration the configuration required by the adopted tool
 * @returns the scope and its tool settings
 */
export function adoptedScope(adoption: AdoptionResult, path: string, configuration: string): AdoptedScope {
    const scope = adoption.scopes.get(path) ?? { configurations: [], tools: {} };
    scope.configurations = [...new Set([...scope.configurations, configuration])];
    adoption.scopes.set(path, scope);
    return scope;
}
