import type { Configuration } from '#cli/types/configurations.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';

export const sqlConfiguration = readConfigurations().get('sql') as Configuration;
