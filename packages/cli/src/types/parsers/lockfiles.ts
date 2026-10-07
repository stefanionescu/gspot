import type { z } from 'zod';
import type { LOCKFILES } from '#cli/config/parsers/lockfiles.ts';
import type { bunPackageSchema } from '#cli/parsers/schema/lockfiles.ts';

type ToolProjectLockfile = Extract<Lockfile, { private: true }>;

/** One npm package entry in a Bun lock, with each slot derived from its parser schema. */
export type BunPackage = [
    identity: z.infer<typeof bunPackageSchema>[0],
    resolved: z.infer<typeof bunPackageSchema>[1],
    metadata: z.infer<typeof bunPackageSchema>[2],
    integrity: z.infer<typeof bunPackageSchema>[3],
];

/** One declared lockfile and its applicable consumers. */
export type Lockfile = (typeof LOCKFILES)[number];

export type LockName = ToolProjectLockfile['client'];

/** The lock a npm tool project records. */
export type ToolProjectLockfileName = ToolProjectLockfile['file'];

/** Textual dependency formats read by the shared lockfile parser. */
export type LockFileName = Extract<Lockfile, { parsed: true }>['file'];
