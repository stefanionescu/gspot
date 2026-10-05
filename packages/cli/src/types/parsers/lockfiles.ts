import type { z } from 'zod';
import type { LOCKS } from '#cli/config/parsers/lockfiles.ts';
import type { bunPackageSchema } from '#cli/parsers/schema/lockfiles.ts';

/** One npm package entry in a Bun lock, with each slot derived from its parser schema. */
export type BunPackage = [
    identity: z.infer<typeof bunPackageSchema>[0],
    resolved: z.infer<typeof bunPackageSchema>[1],
    metadata: z.infer<typeof bunPackageSchema>[2],
    integrity: z.infer<typeof bunPackageSchema>[3],
];

export type Dependencies = Record<string, string>;

export type LockName = keyof typeof LOCKS;

/** Textual dependency formats read by the shared lockfile parser. */
export type LockFileName = (typeof LOCKS)[LockName] | 'uv.lock' | 'poetry.lock' | 'pdm.lock';
