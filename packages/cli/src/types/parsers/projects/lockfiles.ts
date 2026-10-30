import {
    type PYTHON_LOCKFILES,
    type DEPENDENCY_SECTIONS,
    type JAVASCRIPT_LOCKFILES,
} from '#cli/config/parsers/projects/lockfiles.ts';

export type LockfileName = (typeof JAVASCRIPT_LOCKFILES)[number];

export type LockedPackageLockfile = LockfileName | (typeof PYTHON_LOCKFILES)[number];

export type DependencySections = Partial<
    Record<(typeof DEPENDENCY_SECTIONS)[number] | 'peerDependencies', Record<string, unknown> | undefined>
>;

export type NpmLockfile = { packages: Record<string, { version?: string | undefined; [key: string]: unknown }> };

export type BunLockfile = { workspaces: Record<string, unknown>; packages: Record<string, unknown[]> };

export type PnpmLockfile = { importers: Record<string, unknown>; packages: Record<string, unknown> };

export type YarnPackage = { version?: string | undefined; resolved?: string | undefined; [key: string]: unknown };

export type UvLockfile = {
    options?: { 'exclude-newer-span'?: string | undefined } | undefined;
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
