// The dependencies analyses, by the name a manifest check gives them.
import type { Engine } from '#cli/types/checks.ts';
import { licensesPackages } from '#cli/checks/licenses.ts';
import { installPolicy } from '#cli/checks/dependencies/install-policy.ts';
import { lockfileFresh } from '#cli/checks/dependencies/lockfile/fresh.ts';
import { lockfileHosts } from '#cli/checks/dependencies/lockfile/hosts.ts';
import { manifestPolicy } from '#cli/checks/dependencies/manifest-policy.ts';

export const DEPENDENCIES_ANALYSES: Record<string, Engine> = {
    'manifest-policy': manifestPolicy,
    'lockfile-fresh': lockfileFresh,
    'licenses-packages': licensesPackages,
    'install-policy': installPolicy,
    'lockfile-hosts': lockfileHosts,
};
