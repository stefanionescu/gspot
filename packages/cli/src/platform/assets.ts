// Where gspot's own data lives: the repository during development, embedded files in the binary.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

import { toPosix } from '#cli/platform/paths.ts';

type EmbeddedIndex = Record<string, string>;

function findRepositoryRoot(): string {
    let dir = dirname(new URL(import.meta.url).pathname);
    for (let i = 0; i < 6; i += 1) {
        if (existsSync(join(dir, 'presets')) && existsSync(join(dir, 'packages'))) return dir;
        dir = dirname(dir);
    }
    throw new Error('gspot cannot find its presets folder from the source tree.');
}

function walk(dir: string, out: string[]): string[] {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full, out);
        else out.push(full);
    }
    return out;
}

let embedded: EmbeddedIndex | null | undefined;
let devRoot: string | undefined;

function embeddedIndex(): EmbeddedIndex | undefined {
    if (embedded === undefined) embedded = (globalThis as { __gspotEmbedded?: EmbeddedIndex }).__gspotEmbedded ?? null;
    return embedded ?? undefined;
}

function developmentRoot(): string {
    devRoot ??= findRepositoryRoot();
    return devRoot;
}

/** The absolute path of this binary when compiled, for hooks under runner none; undefined when running from source. */
export function binaryPath(): string | undefined {
    return isEmbedded() ? process.execPath : undefined;
}

/** True when running from a compiled binary with embedded assets. */
export function isEmbedded(): boolean {
    return embeddedIndex() !== undefined;
}

/** Reads one asset by its repository-relative path (`presets/bash/manifest.toml`). */
export function readAsset(path: string): string {
    const index = embeddedIndex();
    if (index) {
        const file = index[path];
        if (file === undefined) throw new Error(`gspot has no embedded asset at ${path}.`);
        return readFileSync(file, 'utf8');
    }
    return readFileSync(join(developmentRoot(), path), 'utf8');
}

/** Reads one asset as bytes (grammar WASM files). */
export function readAssetBytes(path: string): Uint8Array {
    const index = embeddedIndex();
    if (index) {
        const file = index[path];
        if (file === undefined) throw new Error(`gspot has no embedded asset at ${path}.`);
        return new Uint8Array(readFileSync(file));
    }
    return new Uint8Array(readFileSync(join(developmentRoot(), path)));
}

/** Lists asset paths under a prefix, repository-relative, sorted. */
export function listAssets(prefix: string): string[] {
    const index = embeddedIndex();
    if (index)
        return Object.keys(index)
            .filter((key) => key.startsWith(prefix))
            .sort();
    const dir = join(developmentRoot(), prefix);
    if (!existsSync(dir)) return [];
    return walk(dir, [])
        .map((full) => toPosix(join(prefix, relative(dir, full))))
        .sort();
}

/** The path an external tool can read for an asset: the file itself in development, the embedded file otherwise. */
export function assetFilePath(path: string): string {
    const index = embeddedIndex();
    if (index) {
        const file = index[path];
        if (file === undefined) throw new Error(`gspot has no embedded asset at ${path}.`);
        return file;
    }
    return join(developmentRoot(), path);
}
