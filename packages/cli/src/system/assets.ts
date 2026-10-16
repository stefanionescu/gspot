// Locates shipped configuration and grammar assets.
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { statSync, readFileSync } from 'node:fs';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { listMatchingPaths } from '#cli/system/files/folders.ts';
import { ALL_FILES_GLOB, GRAMMARS_FOLDER, CLI_PACKAGE_JSON, PACKAGE_SEARCH_DEPTH } from '#cli/config/system/assets.ts';

let cachedPackageFolder: string | undefined;

// The nearest folder above the running code with a package.json and the configurations, or undefined.
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

// The package folder that holds the running code. The source tree and an installed package both have one. Code bundled
// into another build, such as the documentation site, finds the package through module resolution instead.
function getPackageFolder(): string {
    cachedPackageFolder ??= findNearestPackage() ?? dirname(createRequire(import.meta.url).resolve(CLI_PACKAGE_JSON));
    return cachedPackageFolder;
}

/**
 * The file of one asset in the package, for a tool that reads it by path.
 * @param path the asset path, such as `configurations/language/bash/manifest.toml`.
 * @returns the absolute path.
 */
export function buildAssetPath(path: string): string {
    return join(getPackageFolder(), path);
}

/**
 * Reads one asset by its path in the package, such as `configurations/language/bash/manifest.toml`.
 * @param path the package-relative location to decode as UTF-8.
 * @returns the text.
 */
export function readAsset(path: string): string {
    return readFileSync(buildAssetPath(path), 'utf8');
}

/**
 * The path of a grammar WASM file shipped in grammars/.
 * @param name the file name, such as `bash.wasm`.
 * @returns the WASM file path.
 */
export function findWasmPath(name: string): string {
    const root = getPackageFolder();
    const path = join(root, GRAMMARS_FOLDER, name);
    if (statSync(path, { throwIfNoEntry: false }) !== undefined) return path;
    throw new Error(`The WebAssembly file ${name} is missing from the installed package. Reinstall gspot.`);
}

/**
 * Lists asset paths under a prefix, relative to the package, sorted.
 * @param prefix the path prefix, such as `configurations/`.
 * @returns the paths.
 */
export function listAssets(prefix: string): string[] {
    const folder = join(getPackageFolder(), prefix);
    if (statSync(folder, { throwIfNoEntry: false }) === undefined) return [];
    return listMatchingPaths(folder, ALL_FILES_GLOB)
        .map((path) => convertToPosixPath(join(prefix, path)))
        .toSorted((a, b) => a.localeCompare(b));
}
