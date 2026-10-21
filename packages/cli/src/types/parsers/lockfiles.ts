import type { LOCKFILES, DEPENDENCY_SECTIONS } from '#cli/config/parsers/lockfiles.ts';

/** One declared lockfile and its applicable consumers. */
export type Lockfile = (typeof LOCKFILES)[number];

/** The lockfile an npm tool project records. */
export type ToolProjectLockfileName = Extract<Lockfile, { toolProject: true }>['file'];

/** Dependency sections of one workspace entry in a lockfile. */
export type DependencySections = Partial<
    Record<(typeof DEPENDENCY_SECTIONS)[number], Record<string, unknown> | undefined>
>;

/** npm workspace and installed package entries. */
export type NpmLockfile = { packages: Record<string, { version?: string | undefined; [key: string]: unknown }> };

/** Bun workspace declarations and resolved package tuples. */
export type BunLockfile = { workspaces: Record<string, unknown>; packages: Record<string, unknown[]> };

/** pnpm workspace importers and resolved packages. */
export type PnpmLockfile = { importers: Record<string, unknown>; packages: Record<string, unknown> };

/** Version and registry location of one Yarn package entry. */
export type YarnPackage = { version?: string | undefined; resolved?: string | undefined; [key: string]: unknown };

/** uv lockfile fields used by package readers and tool installation. */
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
