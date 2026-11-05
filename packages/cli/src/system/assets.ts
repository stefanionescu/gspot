import { readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';

import { CLI_PACKAGE_JSON } from '#cli/config/system.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { compareText } from '#cli/system/text.ts';

const packageFolder = dirname(createRequire(import.meta.url).resolve(CLI_PACKAGE_JSON));

/**
Build the path of one asset in the package, for a tool that reads it by path.

@param path the asset, such as `src/configurations/language/bash/manifest.toml`.
@returns the absolute path.
*/
export function buildAssetPath(path: string): string {
    return join(packageFolder, path);
}

/**
List the asset paths under a prefix, relative to the package, sorted.

@param prefix the start of the paths, such as `src/configurations/`.
*/
export function listAssets(prefix: string): string[] {
    const folder = join(packageFolder, prefix);
    if (statSync(folder, { throwIfNoEntry: false }) === undefined) return [];
    return readdirSync(folder, { recursive: true, withFileTypes: true })
        .filter((file) => file.isFile())
        .map((file) => convertToPosixPath(relative(packageFolder, join(file.parentPath, file.name))))
        .toSorted((a, b) => compareText(a, b));
}
