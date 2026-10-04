import type { z } from 'zod';
import type { LOCKS } from '#cli/config/parsers/lockfiles.ts';
import type { bunPackageSchema } from '#cli/parsers/schema/lockfiles.ts';

export type BunPackage = z.infer<typeof bunPackageSchema>;

export type Dependencies = Record<string, string>;

export type LockName = keyof typeof LOCKS;

/** Textual dependency formats read by the shared lockfile parser. */
export type LockFileName = (typeof LOCKS)[LockName] | 'uv.lock' | 'poetry.lock' | 'pdm.lock';
