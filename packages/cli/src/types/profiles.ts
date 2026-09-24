// Type aliases of the profile modules.
import type { profileSchema } from '#cli/schemas/profiles.ts';
import type { z } from 'zod';

/** A profile as the schema accepts it. */
export type ProfileTables = z.infer<typeof profileSchema>;

/** A validated profile: where it came from, the SHA-256 of its text, and its tables. */
export type Profile = { source: string; digest: string; tables: ProfileTables };

/** What export left out, and the text it wrote. */
export type ExportedProfile = { text: string; leftOut: string[] };
