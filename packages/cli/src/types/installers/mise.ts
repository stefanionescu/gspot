export type MiseVersion = { version: string };

export type MiseLockfile = { tools: Record<string, MiseVersion[]> };

export type MiseInstall = { installed: string; note: string; binPaths: string[] };
