export type MiseVersion = { version: string };

export type MiseLockfile = { tools: Record<string, MiseVersion[]> };

export type MiseProject = { tools: Record<string, string | MiseVersion> };
