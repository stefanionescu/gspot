import { parse } from 'smol-toml';
import { isRecord } from '#cli/platform/contracts.ts';
import { miseTasksSchema, miseToolsSchema, miseTaskAliasSchema } from '#cli/parsers/schema/mise.ts';

/**
 * Parse the tool keys declared in an authored mise document.
 * @param text the mise.toml contents
 * @returns the declared tool keys
 */
export function parseMiseToolKeys(text: string): Set<string> {
    const config = miseToolsSchema.parse(parse(text));
    return new Set(Object.keys(config.tools));
}

/**
 * Read task names and aliases from an authored mise document.
 * @param text the mise TOML contents
 * @returns task names and the aliases explicitly declared for them
 */
export function parseMiseTasks(text: string): string[] {
    const { tasks } = miseTasksSchema.parse(parse(text));
    return Object.entries(tasks).flatMap(([name, task]) => {
        const alias = isRecord(task) ? miseTaskAliasSchema.parse(task).alias : undefined;
        return [name, ...[alias ?? []].flat()];
    });
}
