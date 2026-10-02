// The types of policy/profiles in this package.
import type { z } from 'zod';
import type { profileSchema } from '#cli/policy/profiles/schema.ts';

type ProfileTables = z.infer<typeof profileSchema>;

export type Profile = { source: string; digest: string; tables: ProfileTables };

export type ExportedProfile = { text: string; leftOut: string[] };
