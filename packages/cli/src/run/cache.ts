// .gspot/cache/: a recorded verdict keyed on the tool version, the configuration hash and the content hash of every file read.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { CheckResult } from '#types/finding.ts';

export type CacheKeyInput = {
    id: string;
    scope: string;
    toolVersion: string;
    configHash: string;
    files: { path: string; hash: string }[];
    extra?: string;
};

function digest(text: string): string {
    return new Bun.CryptoHasher('sha256').update(text).digest('hex');
}

/** The cache key for one check run. */
export function cacheKey(input: CacheKeyInput): string {
    const files = input.files.map((file) => `${file.path}:${file.hash}`).join('\n');
    return digest(
        `${input.id}\n${input.scope}\n${input.toolVersion}\n${input.configHash}\n${input.extra ?? ''}\n${files}`,
    );
}

/** The content hash of a file, or a marker when it cannot be read. */
export function fileHash(root: string, path: string): string {
    try {
        return digest(readFileSync(join(root, path)).toString('base64'));
    } catch {
        return 'unreadable';
    }
}

/** The hash of a text. */
export function textHash(text: string): string {
    return digest(text);
}

function cacheDir(root: string): string {
    return join(root, '.gspot', 'cache');
}

/** A recorded result for a key, or undefined. */
export function readCached(root: string, key: string): CheckResult | undefined {
    const path = join(cacheDir(root), `${key}.json`);
    if (!existsSync(path)) return undefined;
    try {
        return JSON.parse(readFileSync(path, 'utf8')) as CheckResult;
    } catch {
        return undefined;
    }
}

/** Records a result under a key. Only real runs are recorded. */
export function writeCached(root: string, key: string, result: CheckResult): void {
    mkdirSync(cacheDir(root), { recursive: true });
    writeFileSync(
        join(cacheDir(root), `${key}.json`),
        JSON.stringify({ ...result, status: result.status === 'cache' ? 'ok' : result.status }),
    );
}

/** Empties the cache. */
export function clearCache(root: string): void {
    rmSync(cacheDir(root), { recursive: true, force: true });
}
