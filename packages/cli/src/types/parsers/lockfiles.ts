import type { z } from 'zod';
import type { LOCKFILES } from '#cli/config/parsers/lockfiles.ts';
import type { bunPackageSchema } from '#cli/parsers/schema/lockfiles.ts';

type ToolProjectLockfile = Extract<Lockfile, { toolProject: true }>;

/** One npm package entry in a Bun lockfile, with each slot derived from its parser schema. */
export type BunPackage = [
    identity: z.infer<typeof bunPackageSchema>[0],
    address: z.infer<typeof bunPackageSchema>[1],
    metadata: z.infer<typeof bunPackageSchema>[2],
    integrity: z.infer<typeof bunPackageSchema>[3],
];

/** One declared lockfile and its applicable consumers. */
export type Lockfile = (typeof LOCKFILES)[number];

/** The lockfile an npm tool project records. */
export type ToolProjectLockfileName = ToolProjectLockfile['file'];

/** Textual dependency formats read by the shared lockfile parser. */
export type LockfileName = Extract<Lockfile, { parsed: true }>['file'];
