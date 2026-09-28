// The types of tools/packages in this package.
import type { z } from 'zod';
import type { FileObservation } from '#cli/types/platform.ts';
import type { LOCKS } from '#cli/constants/tools/packages.ts';
import type { packageToolSchema } from '#cli/tools/packages/identity.ts';

export type ToolProject = {
    client: PackageTool;
    dependencies: Record<string, string>;
    lock: (typeof LOCKS)[LockName];
    lockPath: string;
};
export type Inputs = { project: FileObservation; recorded: FileObservation; yarn: FileObservation | undefined };
export type PackageTool = z.infer<typeof packageToolSchema>;
export type PackageExecution = {
    root: string;
    work: string;
    client: PackageTool;
    frozen: boolean;
    env: Record<string, string>;
};
export type Dependencies = Record<string, string>;
export type BunPackage = [string, string, Record<string, unknown>, string];
export type LockName = keyof typeof LOCKS;
