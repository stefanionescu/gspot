import type { z } from 'zod';
import type { Tool } from '#cli/types/manifests.ts';
import type { Session } from '#cli/types/session.ts';
import type { Files } from '#cli/types/system/files.ts';
import type { Generation } from '#cli/types/generation/files.ts';
import type { PackageManager, PackageManagerCommand } from '#cli/types/repository/javascript.ts';
import type { miseLockfileSchema, uvProjectSettingsSchema } from '#cli/schemas/installers/installers.ts';

export type ArchiveDownload = {
    url: string;
    name: string;
    limit: number;
};

export type HookStatus = { ready: boolean; text: string };

export type HookPlan = { command?: readonly string[]; note: string };

export type InstallResult = { installed: string[]; notes: string[]; steps: readonly (readonly string[])[] };

export type ToolPackageManager = PackageManager & {
    name: Exclude<PackageManager['name'], 'yarn'>;
    command: PackageManagerCommand;
};

export type ToolInstall = {
    session: Session;
    packageManager: ToolPackageManager | undefined;
    releaseAgeDays: number;
    writer: Files;
    generated: Generation;
    tools: Tool[];
    misePath: string | null;
    steps: (readonly string[])[];
};

export type MiseVersion = z.infer<typeof miseLockfileSchema>['tools'][string][number];

export type MiseInstall = { installed: string; note: string; binPaths: string[] };

export type StaleLockfile = { path: string; kind: 'missing' | 'changed' };

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
