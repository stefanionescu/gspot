import type { z } from 'zod';
import type { miseLockfileSchema } from '#cli/schemas/installers/mise.ts';

export type MiseVersion = z.infer<typeof miseLockfileSchema>['tools'][string][number];

export type MiseInstall = { installed: string; note: string; binPaths: string[] };
