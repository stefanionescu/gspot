import type { Manifest } from '#cli/configurations/read-manifests.ts';
import { PRIVATE_PATHS } from '#cli/platform/paths.ts';

import { configurationManifests } from '#cli/configurations/read-manifests.ts';

/**
 * The .gitignore block: the paths gspot writes that git never tracks.
 * @param manifests
 * @returns the block body
 */
export function gitignoreBlock(
    manifests: Iterable<Pick<Manifest, 'untracked'>> = configurationManifests().values(),
): string {
    return [...new Set([...PRIVATE_PATHS, ...[...manifests].flatMap((manifest) => manifest.untracked)])].join('\n');
}
