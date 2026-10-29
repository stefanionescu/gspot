import { statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { compareText } from '#cli/system/text.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { listMatchingPaths } from '#cli/system/files/folders.ts';
import { ALL_FILES_GLOB, CLI_PACKAGE_JSON } from '#cli/config/system/assets.ts';

const packageFolder = dirname(createRequire(import.meta.url).resolve(CLI_PACKAGE_JSON));

/**
Build the path of one asset in the package, for a tool that reads it by path.

@param path the asset, such as `configurations/language/bash/manifest.toml`.
@returns the absolute path.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Callers in many layers find a package asset from the package folder that this module finds once.
export function buildAssetPath(path: string): string {
    return join(packageFolder, path);
}

/**
List the asset paths under a prefix, relative to the package, sorted.

@param prefix the start of the paths, such as `configurations/`.
*/
export function listAssets(prefix: string): string[] {
    const folder = join(packageFolder, prefix);
    if (statSync(folder, { throwIfNoEntry: false }) === undefined) return [];
    return listMatchingPaths(folder, [ALL_FILES_GLOB])
        .map((path) => convertToPosixPath(join(prefix, path)))
        .toSorted((a, b) => compareText(a, b));
}
