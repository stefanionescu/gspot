/** One npm package entry in a Bun lockfile, with each slot derived from its parser schema. */

/** One npm package entry in a Bun lockfile, with each slot derived from its parser schema. */
import type { LOCKFILES } from '#cli/config/parsers/lockfiles.ts';

/** One declared lockfile and its applicable consumers. */
export type Lockfile = (typeof LOCKFILES)[number];

/** The lockfile an npm tool project records. */
export type ToolProjectLockfileName = Extract<Lockfile, { toolProject: true }>['file'];

/** Textual dependency formats read by the shared lockfile parser. */
