// Where the gspot data lives: the repository during development, embedded files in the binary.
import { globbySync } from 'globby';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { toPosix } from '#cli/platform/paths.ts';
import { existsSync, readFileSync } from 'node:fs';
import { GRAMMAR_SOURCES } from '#cli/naming/grammars-definitions.ts';
import type { EmbeddedIndex } from '#cli/platform/types.ts';

const ROOT_SEARCH_DEPTH = 6;

const state: { embedded: EmbeddedIndex | null | undefined; developmentRoot: string | undefined } = {
    embedded: undefined,
    developmentRoot: undefined,
};

function findRepoRoot(): string {
    let dir = dirname(fileURLToPath(new URL(import.meta.url)));
    for (let index = 0; index < ROOT_SEARCH_DEPTH; index += 1) {
        if (existsSync(join(dir, 'presets')) && existsSync(join(dir, 'packages'))) return dir;
        dir = dirname(dir);
    }
    throw new Error('The presets folder is not beside the source tree.');
}

function embeddedIndex(): EmbeddedIndex | undefined {
    state.embedded ??= (globalThis as { gspotEmbedded?: EmbeddedIndex }).gspotEmbedded ?? null;
    return state.embedded ?? undefined;
}

function developmentRoot(): string {
    state.developmentRoot ??= findRepoRoot();
    return state.developmentRoot;
}

/**
 * The absolute path of this binary when compiled, for hooks under runner none; undefined when running from source.
 * @returns the path, or undefined
 */
export function binaryPath(): string | undefined {
    return isEmbedded() ? process.execPath : undefined;
}

/**
 * True when running from a compiled binary with embedded assets.
 * @returns whether the assets are embedded
 */
export function isEmbedded(): boolean {
    return embeddedIndex() !== undefined;
}

/**
 * Reads one asset by its repository-relative path (`presets/bash/manifest.toml`).
 * @param path the asset path
 * @returns the text
 */
export function readAsset(path: string): string {
    const index = embeddedIndex();
    if (index) {
        const file = index[path];
        if (file === undefined) throw new Error(`No embedded asset is at ${path}.`);
        return readFileSync(file, 'utf8');
    }
    return readFileSync(join(developmentRoot(), path), 'utf8');
}

/**
 * The installed path of a grammar file: embedded in the binary, or read from its npm package during development.
 * @param name the file name under grammars/, such as `bash.wasm`
 * @returns the WASM asset path
 */
export function grammarPath(name: string): string {
    const index = embeddedIndex();
    const embedded = index?.[`grammars/${name}`];
    if (embedded !== undefined) return embedded;
    const root = developmentRoot();
    const vendored = join(root, 'packages', 'cli', 'grammars', name);
    const source = GRAMMAR_SOURCES[name];
    if (source === undefined && existsSync(vendored)) return vendored;
    if (source === undefined) throw new Error(`No grammar is called ${name}.`);
    const candidates = [join(root, 'packages', 'cli', 'node_modules', source), join(root, 'node_modules', source)];
    const found = candidates.find((candidate) => existsSync(candidate));
    if (found === undefined) throw new Error(`The grammar package for ${name} is not installed; run bun install.`);
    return found;
}

/**
 * Lists asset paths under a prefix, repository-relative, sorted.
 * @param prefix the path prefix, such as `presets/`
 * @returns the paths
 */
export function listAssets(prefix: string): string[] {
    const index = embeddedIndex();
    if (index)
        return Object.keys(index)
            .filter((key) => key.startsWith(prefix))
            .toSorted((a, b) => a.localeCompare(b));
    const dir = join(developmentRoot(), prefix);
    if (!existsSync(dir)) return [];
    return globbySync('**/*', { cwd: dir, dot: true })
        .map((path) => toPosix(join(prefix, path)))
        .toSorted((a, b) => a.localeCompare(b));
}
