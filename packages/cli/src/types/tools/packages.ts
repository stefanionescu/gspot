// The types of tools/packages in this package.
import type { z } from 'zod';
import type { LOCKS } from '#cli/config/tools/packages.ts';
import type { Read } from '#cli/types/platform/platform.ts';
import type { packageToolSchema } from '#cli/tools/packages/identity.ts';

export type ToolProject = {
    client: PackageTool;
    dependencies: Record<string, string>;
    lock: (typeof LOCKS)[LockName];
    lockPath: string;
};
export type Inputs = { project: Read; recorded: Read; yarn: Read | undefined };

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

export type PackageTool = z.infer<typeof packageToolSchema>;
