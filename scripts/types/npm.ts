import type { z } from 'zod';
import type { npmPackageIdentitySchema } from '#automation/parsers/npm.ts';

/** Installed package identity verified before reading a pinned preset. */
export type NpmPackageIdentity = z.infer<typeof npmPackageIdentitySchema>;
