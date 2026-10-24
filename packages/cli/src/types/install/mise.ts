export type MisePin = { version: string };

export type MiseLockfile = { tools: Record<string, MisePin[]> };

export type MiseProject = { tools: Record<string, string | MisePin> };
