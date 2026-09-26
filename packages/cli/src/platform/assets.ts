// Where the gspot data lives: the repository during development, embedded files in the binary.
import { globbySync } from 'globby';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, statSync } from 'node:fs';
import { toPosix } from '#cli/platform/paths.ts';

const GRAMMAR_SOURCES: Record<string, string> = {
    'bash.wasm': 'tree-sitter-bash/tree-sitter-bash.wasm',
    'css.wasm': 'tree-sitter-css/tree-sitter-css.wasm',
    'html.wasm': 'tree-sitter-html/tree-sitter-html.wasm',
    'javascript.wasm': 'tree-sitter-javascript/tree-sitter-javascript.wasm',
    'python.wasm': 'tree-sitter-python/tree-sitter-python.wasm',
    'tsx.wasm': 'tree-sitter-typescript/tree-sitter-tsx.wasm',
    'typescript.wasm': 'tree-sitter-typescript/tree-sitter-typescript.wasm',
    'web-tree-sitter.wasm': 'web-tree-sitter/web-tree-sitter.wasm',
    'libpg-query.wasm': 'libpg-query/wasm/libpg-query.wasm',
};

type EmbeddedIndex = Record<string, string>;

const ROOT_SEARCH_DEPTH = 6;

const state: { embedded: EmbeddedIndex | null | undefined; developmentRoot: string | undefined } = {
    embedded: undefined,
    developmentRoot: undefined,
};

function findRepoRoot(): string {
    let dir = dirname(fileURLToPath(new URL(import.meta.url)));
    for (let index = 0; index < ROOT_SEARCH_DEPTH; index += 1) {
        if (
            statSync(join(dir, 'packages/cli/configurations'), { throwIfNoEntry: false }) !== undefined &&
            statSync(join(dir, 'packages'), { throwIfNoEntry: false }) !== undefined
        )
            return dir;
        dir = dirname(dir);
    }
    throw new Error('The configurations folder is not beside the source tree.');
}

function embeddedIndex(): EmbeddedIndex | undefined {
    state.embedded ??= (globalThis as { gspotEmbedded?: EmbeddedIndex }).gspotEmbedded ?? null;
    return state.embedded ?? undefined;
}

function developmentRoot(): string {
    state.developmentRoot ??= findRepoRoot();
    return state.developmentRoot;
}

export const GRAMMAR_NAMES = [...Object.keys(GRAMMAR_SOURCES), 'swift.wasm'];

/** The pinned upstream Swift parser: the build downloads it and verifies this checksum before embedding it. */
export const SWIFT_GRAMMAR = {
    version: '0.7.3',
    url: 'https://github.com/alex-pinkus/tree-sitter-swift/releases/download/0.7.3/tree-sitter-swift.wasm',
    sha256: '0258a7ef17303a8079ffe0748b3583d59656b5c3e8653fca7b6451b3e6689eb2',
} as const;

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
 * Reads one asset by its repository-relative path (`packages/cli/configurations/language/bash/manifest.toml`).
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
    if (!GRAMMAR_NAMES.includes(name)) throw new Error(`No grammar is called ${name}.`);
    const index = embeddedIndex();
    if (index !== undefined) {
        const embedded = index[`grammars/${name}`];
        if (embedded === undefined) throw new Error(`No embedded grammar is called ${name}.`);
        return embedded;
    }
    const root = developmentRoot();
    if (name === 'swift.wasm') {
        const path = join(root, 'packages', 'cli', '.build', name);
        if (statSync(path, { throwIfNoEntry: false }) === undefined)
            throw new Error('The Swift grammar is not prepared; run mise run prepare:grammar.');
        return path;
    }
    const source = GRAMMAR_SOURCES[name];
    if (source === undefined) throw new Error(`No grammar source is known for ${name}.`);
    const candidates = [join(root, 'packages', 'cli', 'node_modules', source), join(root, 'node_modules', source)];
    const found = candidates.find((candidate) => statSync(candidate, { throwIfNoEntry: false }) !== undefined);
    if (found === undefined) throw new Error(`The grammar package for ${name} is not installed; run bun install.`);
    return found;
}

/**
 * Lists asset paths under a prefix, repository-relative, sorted.
 * @param prefix the path prefix, such as `configurations/`
 * @returns the paths
 */
export function listAssets(prefix: string): string[] {
    const index = embeddedIndex();
    if (index)
        return Object.keys(index)
            .filter((key) => key.startsWith(prefix))
            .toSorted((a, b) => a.localeCompare(b));
    const dir = join(developmentRoot(), prefix);
    if (statSync(dir, { throwIfNoEntry: false }) === undefined) return [];
    return globbySync('**/*', { cwd: dir, dot: true })
        .map((path) => toPosix(join(prefix, path)))
        .toSorted((a, b) => a.localeCompare(b));
}
