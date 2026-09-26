import { PRIVATE_PATHS } from '#cli/platform/paths.ts';
import type { Manifest } from '#cli/configurations/manifests.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';

/**
 * The .gitignore block: the paths gspot writes that git never tracks.
 * @param manifests the manifests whose untracked paths count, every one by default
 * @returns the block body
 */
export function gitignoreBlock(
    manifests: Iterable<Pick<Manifest, 'untracked'>> = configurationManifests().values(),
): string {
    return [...new Set([...PRIVATE_PATHS, ...[...manifests].flatMap((manifest) => manifest.untracked)])].join('\n');
}
