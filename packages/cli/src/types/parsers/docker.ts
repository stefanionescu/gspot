import type { z } from 'zod';
import type { composeSchema } from '#cli/parsers/schema/docker.ts';

/** One validated native service consumed by build-context and image checks. */
export type ComposeService = NonNullable<z.infer<typeof composeSchema>['services']>[string];
