import type { LOCKS } from '#cli/constants/tools/packages.ts';
// The types of tools/packages in this package.
import type { z } from 'zod';
import type { FileSnapshot } from '#cli/types/platform.ts';
import type { packageManagerSchema } from '#cli/tools/packages/manager.ts';

export type ToolProject = {
    manager: ToolPackageManager;
    dependencies: Record<string, string>;
    lock: (typeof LOCKS)[LockName];
    lockPath: string;
};
export type Inputs = { project: FileSnapshot; recorded: FileSnapshot; yarn: FileSnapshot | undefined };
export type ToolPackageManager = z.infer<typeof packageManagerSchema>;
export type Resolution = {
    root: string;
    work: string;
    manager: ToolPackageManager;
    frozen: boolean;
    env: Record<string, string>;
};
export type Dependencies = Record<string, string>;
export type BunPackage = [string, string, Record<string, unknown>, string];
export type LockName = keyof typeof LOCKS;
