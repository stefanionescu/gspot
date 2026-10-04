import type { z } from 'zod';
import type { webManifestSchema } from '#cli/parsers/schema/site.ts';

/** Web manifest data validated before its icon paths are inspected. */
export type WebManifest = z.infer<typeof webManifestSchema>;
