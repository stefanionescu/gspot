import type { EnvOwnerOptions } from '#plugin/types/environment.ts';

export const OWNERS: [Partial<EnvOwnerOptions[0]>] = [{ owners: ['src/env/**', 'config/**'] }];
