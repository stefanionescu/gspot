// The {each:<flag>:<setting>} command part: the flag followed by one item, for every item of a list setting.
import type { PlannedCheck } from '#types/run.ts';
import { toPlatform } from '#cli/platform/paths.ts';

const EACH_PLACEHOLDER = /^\{each:(?<flag>[^:]+):(?<setting>[a-z0-9_.-]+)\}$/u;

/**
 * Expands an each part, or returns undefined when the part is something else.
 * @param planned the check, whose scope holds the settings
 * @param part one part of the manifest command
 * @returns the arguments, empty when the list is empty
 */
export function listArguments(planned: PlannedCheck, part: string): string[] | undefined {
    const groups = EACH_PLACEHOLDER.exec(part)?.groups;
    if (groups === undefined) return undefined;
    const items = (planned.scope.view.settings[groups['setting'] ?? ''] as string[] | undefined) ?? [];
    return items.flatMap((item) => [groups['flag'] ?? '', toPlatform(item)]);
}
