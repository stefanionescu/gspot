import type { z } from 'zod';
import type { composeSchema } from '#cli/parsers/schema/docker.ts';

/** Compose services validated before their literal images are scanned. */
export type ComposeProject = z.infer<typeof composeSchema>;
