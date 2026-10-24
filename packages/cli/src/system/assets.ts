import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { compareText } from '#cli/system/text.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { listMatchingPaths } from '#cli/system/files/folders.ts';
import { ALL_FILES_GLOB, GRAMMARS_FOLDER, CLI_PACKAGE_JSON, PACKAGE_SEARCH_DEPTH } from '#cli/config/system/assets.ts';

function findNearestPackage(): string | undefined {
    let folder = dirname(fileURLToPath(import.meta.url));
    for (let index = 0; index < PACKAGE_SEARCH_DEPTH; index += 1) {
        if (
            statSync(join(folder, 'package.json'), { throwIfNoEntry: false }) !== undefined &&
            statSync(join(folder, 'configurations'), { throwIfNoEntry: false })?.isDirectory() === true
        )
            return folder;
        folder = dirname(folder);
    }
    return undefined;
}

const packageFolder = findNearestPackage() ?? dirname(createRequire(import.meta.url).resolve(CLI_PACKAGE_JSON));

/**
 * Build the path of one asset in the package, for a tool that reads it by path.
 *
 * @param path the asset, such as `configurations/language/bash/manifest.toml`.
 * @returns the absolute path.
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 16 calls in 13 files share it.
export function buildAssetPath(path: string): string {
    return join(packageFolder, path);
}

/**
 * Find the path of a grammar WASM file in grammars/.
 *
 * @param name the WASM file, such as `bash.wasm`.
 * @returns the WASM file path.
 */
export function findWasmPath(name: string): string {
    const root = packageFolder;
    const path = join(root, GRAMMARS_FOLDER, name);
    if (statSync(path, { throwIfNoEntry: false }) !== undefined) return path;
    throw new Error(`The WebAssembly file ${name} is missing from the installed package. Reinstall gspot.`);
}

/**
 * List the asset paths under a prefix, relative to the package, sorted.
 *
 * @param prefix the start of the paths, such as `configurations/`.
 * @returns the paths.
 */
export function listAssets(prefix: string): string[] {
    const folder = join(packageFolder, prefix);
    if (statSync(folder, { throwIfNoEntry: false }) === undefined) return [];
    return listMatchingPaths(folder, ALL_FILES_GLOB)
        .map((path) => convertToPosixPath(join(prefix, path)))
        .toSorted((a, b) => compareText(a, b));
}
