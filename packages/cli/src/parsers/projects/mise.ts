import { isTable } from '#cli/system/tables.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml/document.ts';
import { miseTasksSchema, miseTaskAliasSchema } from '#cli/schemas/parsers/projects/mise.ts';

/**
 * Read task names and aliases from a mise document.
 *
 * @param text the mise TOML contents.
 * @param path the source mise file.
 * @returns task names and the aliases explicitly declared for them.
 */
export function parseMiseTasks(text: string, path: string): string[] {
    const { tasks } = parseTomlFile(path, text, miseTasksSchema);
    return Object.entries(tasks).flatMap(([name, task]) => {
        const alias = isTable(task) ? miseTaskAliasSchema.parse(task).alias : undefined;
        return [name, ...[alias ?? []].flat()];
    });
}
