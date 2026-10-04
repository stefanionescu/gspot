// Where the gspot data lives: the configurations, rules, and grammars beside the code. The source tree and the package
// share that layout.
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { statSync, readFileSync } from 'node:fs';
import { toPosix, globPaths } from '#cli/platform/paths.ts';
import { ROOT_SEARCH_DEPTH } from '#cli/config/platform/runtime.ts';
import { RUNTIME_WASM, SWIFT_GRAMMAR, GRAMMAR_PACKAGES, STANDALONE_BUILD } from '#cli/config/platform/assets.ts';

let packageDirectory: string | undefined;

// The nearest folder above the running code with a package.json and the configurations, or undefined.
function nearestPackage(): string | undefined {
    let dir = dirname(fileURLToPath(import.meta.url));
    for (let index = 0; index < ROOT_SEARCH_DEPTH; index += 1) {
        if (
            statSync(join(dir, 'package.json'), { throwIfNoEntry: false }) !== undefined &&
            statSync(join(dir, 'configurations'), { throwIfNoEntry: false })?.isDirectory() === true
        )
            return dir;
        dir = dirname(dir);
    }
    return undefined;
}

// The package folder that holds the running code. The source tree and an installed package both have one. Code bundled
// into another build, such as the documentation site, finds the package through module resolution instead.

function packageRoot(): string {
    packageDirectory ??= STANDALONE_BUILD
        ? dirname(process.execPath)
        : (nearestPackage() ?? dirname(createRequire(import.meta.url).resolve('@gspothq/cli/package.json')));
    return packageDirectory;
}

/**
 * The file of one asset in the package, for a tool that reads it by path.
 * @param path the asset path, such as `configurations/language/bash/ast-grep/branches.yml`
 * @returns the absolute path
 */
export function assetPath(path: string): string {
    return join(packageRoot(), path);
}

/**
 * Reads one asset by its path in the package, such as `configurations/language/bash/manifest.toml`.
 * @param path the asset path
 * @returns the text
 */
export function readAsset(path: string): string {
    return readFileSync(assetPath(path), 'utf8');
}

/**
 * The path of a grammar or runtime WASM file prepared by setup and shipped in grammars/.
 * @param name the file name, such as `bash.wasm`
 * @returns the WASM file path
 */
export function wasmPath(name: string): string {
    if (!Object.hasOwn(GRAMMAR_PACKAGES, name) && !Object.hasOwn(RUNTIME_WASM, name) && name !== SWIFT_GRAMMAR.name)
        throw new Error(`No WebAssembly file named ${name} ships with gspot.`);
    const root = packageRoot();
    const path = join(root, 'grammars', name);
    if (statSync(path, { throwIfNoEntry: false }) !== undefined) return path;
    throw new Error(`The WebAssembly file ${name} is missing from the installed package. Reinstall gspot.`);
}

/**
 * Lists asset paths under a prefix, relative to the package, sorted.
 * @param prefix the path prefix, such as `configurations/`
 * @returns the paths
 */
export function listAssets(prefix: string): string[] {
    const dir = join(packageRoot(), prefix);
    if (statSync(dir, { throwIfNoEntry: false }) === undefined) return [];
    return globPaths(dir, '**/*', { dot: true })
        .map((path) => toPosix(join(prefix, path)))
        .toSorted((a, b) => a.localeCompare(b));
}
