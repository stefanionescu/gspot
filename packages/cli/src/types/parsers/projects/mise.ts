export type MiseTools = { tools: Record<string, unknown> };

export type MiseTask = { alias?: string | string[] | undefined };

export type MiseTasks = { tasks: Record<string, string | string[] | MiseTask> };
