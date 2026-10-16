import type { LOCKFILES } from '#cli/config/parsers/lockfiles.ts';

/** One declared lockfile and its applicable consumers. */
export type Lockfile = (typeof LOCKFILES)[number];

/** The lockfile an npm tool project records. */
export type ToolProjectLockfileName = Extract<Lockfile, { toolProject: true }>['file'];
