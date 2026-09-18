// Type aliases of the platform modules.

export type EmbeddedIndex = Record<string, string>;

export type SpawnResult = { code: number; stdout: string; stderr: string; missing: boolean; duration: number };

export type SpawnOptions = { cwd: string; env?: Record<string, string>; stdin?: string; timeoutMs?: number };
