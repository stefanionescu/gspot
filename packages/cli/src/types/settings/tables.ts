import { type Defined } from '#cli/types/shapes.ts';
import type { TableValues } from '#cli/types/settings/file.ts';
import type { toolsSchema } from '#cli/schemas/settings/tools/tables.ts';

export type ConfigurationTables = Defined<
    Required<Omit<TableValues, 'format' | 'limits' | 'naming' | 'structure' | `tools.${string}`>>
>;

export type ToolTableSchemas = {
    [Tool in keyof typeof toolsSchema.shape as `tools.${Tool}`]: (typeof toolsSchema.shape)[Tool];
};
