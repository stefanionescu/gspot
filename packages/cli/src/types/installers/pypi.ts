import type { z } from 'zod';
import type { uvProjectSettingsSchema } from '#cli/schemas/installers/pypi.ts';

export type UvCommand = {
    runFolder: string;
    commandArguments: readonly string[];
    executable: string;
    credentials: string[];
    configFile?: string;
};

export type PythonIndexSettings = {
    settings: z.infer<typeof uvProjectSettingsSchema>['tool']['uv'];
    credentials: string[];
};

export type PythonToolProject = { name: string; version: string; 'requires-python': string; dependencies: string[] };
