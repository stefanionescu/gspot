// Reads mise tasks and tool pins.
import { z } from 'zod';
import { parse } from 'smol-toml';
import { isRecord } from '#cli/objects.ts';
import type { SchemaShape } from '#cli/types/objects.ts';

const miseTasksSchema = z.object({ tasks: z.record(z.string(), z.unknown()).default({}) } satisfies SchemaShape<{
    tasks: Record<string, unknown>;
}>);
const miseTaskAliasSchema = z.object({
    alias: (z.union([z.string(), z.array(z.string())]) satisfies z.ZodType<string | string[]>).optional(),
} satisfies SchemaShape<{ alias?: string | string[] | undefined }>);

/**
 * Read task names and aliases from a mise document.
 * @param text the mise TOML contents.
 * @returns task names and the aliases explicitly declared for them.
 */
export function parseMiseTasks(text: string): string[] {
    const { tasks } = miseTasksSchema.parse(parse(text));
    return Object.entries(tasks).flatMap(([name, task]) => {
        const alias = isRecord(task) ? miseTaskAliasSchema.parse(task).alias : undefined;
        return [name, ...[alias ?? []].flat()];
    });
}
