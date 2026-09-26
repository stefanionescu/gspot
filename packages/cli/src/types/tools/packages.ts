// The types of tools/packages in this package.
import type { z } from 'zod';
import type { FileSnapshot } from '#cli/types/platform.ts';
import type { packageManagerSchema, parsePackageManager } from '#cli/tools/packages/manager.ts';

export type ToolProject = {
    manager: PackageManager;
    dependencies: Record<string, string>;
    lock: (typeof LOCKS)[LockName];
    lockPath: string;
};
export type PackageManager = ReturnType<typeof parsePackageManager>;
export type Inputs = { project: FileSnapshot; recorded: FileSnapshot; yarn: FileSnapshot | undefined };
export type ToolPackageManager = z.infer<typeof packageManagerSchema>;
export type Resolution = {
    root: string;
    work: string;
    manager: PackageManager;
    frozen: boolean;
    env: Record<string, string>;
};
export type Dependencies = Record<string, string>;
export type BunPackage = [string, string, Record<string, unknown>, string];
/** The lock file each package manager writes. */
export const LOCKS = { npm: 'package-lock.json', bun: 'bun.lock', pnpm: 'pnpm-lock.yaml', yarn: 'yarn.lock' } as const;
export type LockName = keyof typeof LOCKS;
