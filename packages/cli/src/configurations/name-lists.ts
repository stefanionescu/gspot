// Reads a shipped list of names copied from one export of a pinned npm package.
import { readAsset } from '#cli/system/assets.ts';
import type { NameList } from '#cli/types/configurations.ts';
import { nameListSchema } from '#cli/schemas/configurations/name-lists.ts';

/**
 * Read one shipped list of names.
 *
 * @param path the asset path of the list.
 * @returns the package and version the list comes from, and its names.
 */
export function readNameList(path: string): NameList {
    return nameListSchema.parse(JSON.parse(readAsset(path)));
}
