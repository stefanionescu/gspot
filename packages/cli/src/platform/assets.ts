// Where the gspot data lives: the kits, guides, and grammars beside the code. The source tree and the package
// share that layout.
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { statSync, readFileSync } from 'node:fs';
import { toPosix, globPaths } from '#cli/platform/paths.ts';
import { RUNTIME_WASM, GRAMMAR_FILES, ROOT_SEARCH_DEPTH } from '#cli/config/platform/platform.ts';

const state: { root: string | undefined } = { root: undefined };

// The nearest folder above the running code with a package.json and the kits, or undefined.
function nearestPackage(): string | undefined {
    let dir = dirname(fileURLToPath(import.meta.url));
    for (let index = 0; index < ROOT_SEARCH_DEPTH; index += 1) {
        if (
            statSync(join(dir, 'package.json'), { throwIfNoEntry: false }) !== undefined &&
            statSync(join(dir, 'kits'), { throwIfNoEntry: false })?.isDirectory() === true
        )
            return dir;
        dir = dirname(dir);
    }
    return undefined;
}

// The package folder that holds the running code. The source tree and an installed package both have one. Code bundled
// into another build, such as the documentation site, finds the package through module resolution instead.
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The package root is found once; the state object owns the answer.
function packageRoot(): string {
    state.root ??= nearestPackage() ?? dirname(createRequire(import.meta.url).resolve('@gspothq/cli/package.json'));
    return state.root;
}

export const GRAMMAR_NAMES = [...GRAMMAR_FILES, ...Object.keys(RUNTIME_WASM)];

/**
 * The file of one asset in the package, for a tool that reads it by path.
 * @param path the asset path, such as `kits/language/bash/ast-grep/branches.yml`
 * @returns the absolute path
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: readAsset and the tools that read a shipped file by path find it under the same package root.
export function assetPath(path: string): string {
    return join(packageRoot(), path);
}

/**
 * Reads one asset by its path in the package, such as `kits/language/bash/manifest.toml`.
 * @param path the asset path
 * @returns the text
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Nine callers in six modules read a package asset by its path; this finds the package root for each.
export function readAsset(path: string): string {
    return readFileSync(assetPath(path), 'utf8');
}

/**
 * The path of a grammar file: shipped in grammars/, or read from the runtime package that owns it.
 * @param name the file name, such as `bash.wasm`
 * @returns the WASM file path
 */
export function grammarPath(name: string): string {
    if (!GRAMMAR_NAMES.includes(name)) throw new Error(`No grammar is called ${name}.`);
    const root = packageRoot();
    const source = RUNTIME_WASM[name];
    if (source !== undefined) return createRequire(join(root, 'package.json')).resolve(source);
    const path = join(root, 'grammars', name);
    if (statSync(path, { throwIfNoEntry: false }) === undefined)
        throw new Error(`The grammar ${name} is missing from the installed package. Reinstall @gspothq/cli.`);
    return path;
}

/**
 * Lists asset paths under a prefix, relative to the package, sorted.
 * @param prefix the path prefix, such as `kits/`
 * @returns the paths
 */
export function listAssets(prefix: string): string[] {
    const dir = join(packageRoot(), prefix);
    if (statSync(dir, { throwIfNoEntry: false }) === undefined) return [];
    return globPaths(dir, '**/*', { dot: true })
        .map((path) => toPosix(join(prefix, path)))
        .toSorted((a, b) => a.localeCompare(b));
}
