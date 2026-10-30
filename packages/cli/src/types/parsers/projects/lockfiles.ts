import type { z } from 'zod';
import type { uvLockfileSchema } from '#cli/schemas/parsers/projects/lockfiles.ts';
import { type PYTHON_LOCKFILES, type JAVASCRIPT_LOCKFILES } from '#cli/config/parsers/projects/lockfiles.ts';

export type LockfileName = (typeof JAVASCRIPT_LOCKFILES)[number];

export type LockedPackageLockfile = LockfileName | (typeof PYTHON_LOCKFILES)[number];

export type UvLockfile = z.infer<typeof uvLockfileSchema>;
