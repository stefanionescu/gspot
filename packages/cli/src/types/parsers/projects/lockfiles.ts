import type { LOCKFILES } from '#cli/config/files/lockfiles.ts';
import type { DEPENDENCY_SECTIONS, JAVASCRIPT_LOCKFILES } from '#cli/config/parsers/projects/lockfiles.ts';

export type Lockfile = (typeof LOCKFILES)[number];

export type LockfileName = (typeof JAVASCRIPT_LOCKFILES)[number];

export type ToolProjectLockfileName = Extract<Lockfile, { toolProject: true }>['file'];

export type DependencySections = Partial<
    Record<(typeof DEPENDENCY_SECTIONS)[number], Record<string, unknown> | undefined>
>;

export type NpmLockfile = { packages: Record<string, { version?: string | undefined; [key: string]: unknown }> };

export type BunLockfile = { workspaces: Record<string, unknown>; packages: Record<string, unknown[]> };

export type PnpmLockfile = { importers: Record<string, unknown>; packages: Record<string, unknown> };

export type YarnPackage = { version?: string | undefined; resolved?: string | undefined; [key: string]: unknown };

export type UvLockfile = {
    version?: number | undefined;
    'requires-python'?: string | undefined;
    package: {
        name: string;
        version?: string | undefined;
        source?: { virtual?: string | undefined; [key: string]: unknown } | undefined;
        metadata?:
            | {
                  'requires-dist'?: { name: string; specifier?: string | undefined }[] | undefined;
                  [key: string]: unknown;
              }
            | undefined;
        [key: string]: unknown;
    }[];
};
