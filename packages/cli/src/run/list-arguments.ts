// Command parts that read the policy: {each:<flag>:<setting>} is the flag and one item for every item of a list, and {setting:<name>} is one value.
import type { PlannedCheck } from '#types/run.ts';
import { toPlatform } from '#cli/platform/paths.ts';

const SETTING_PLACEHOLDER = /\{setting:(?<name>[a-z\d_.-]+)\}/gu;
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

/**
 * Replaces every setting placeholder in a command part with the value the policy holds.
 * @param planned the check, whose scope holds the settings
 * @param part one part of the manifest command
 * @returns the part with the values in place; a setting with no value becomes an empty string
 */
export function settingsFilled(planned: PlannedCheck, part: string): string {
    return part.replaceAll(SETTING_PLACEHOLDER, (_match, name: string) => {
        const found = planned.scope.view.settings[name];
        return typeof found === 'string' || typeof found === 'number' || typeof found === 'boolean'
            ? String(found)
            : '';
    });
}
