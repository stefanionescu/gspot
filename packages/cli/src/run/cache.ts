// .gspot/cache/: a recorded verdict keyed on the tool version, the configuration hash and the content hash of every file read.
import { join } from 'node:path';
import type { CacheKeyInput } from '#types/run.ts';
import type { CheckResult } from '#types/finding.ts';
import { reportStorageFailure } from '#cli/output/messages.ts';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const CACHE_FORMAT = 3;

function cacheDir(root: string): string {
    return join(root, '.gspot', 'cache');
}

/**
 * The SHA-256 hex digest of a text.
 * @param text the text
 * @returns the digest
 */
export function textHash(text: string): string {
    return new Bun.CryptoHasher('sha256').update(text).digest('hex');
}

/**
 * The cache key for one check run.
 * @param input the check name, scope, tool version, configuration hash and file hashes
 * @returns the key
 */
export function cacheKey(input: CacheKeyInput): string {
    const files = input.files.map((file) => `${file.path}:${file.hash}`).join('\n');
    return textHash(
        `${String(CACHE_FORMAT)}\n${input.check}\n${input.scope}\n${input.toolVersion}\n${input.configurationHash}\n${input.extra ?? ''}\n${files}`,
    );
}

/**
 * The content hash of a file, or a marker when it cannot be read.
 * @param root the repository root
 * @param path the file, relative to the root
 * @returns the digest, or `unreadable`
 */
export function fileHash(root: string, path: string): string {
    try {
        return textHash(readFileSync(join(root, path)).toString('base64'));
    } catch {
        return 'unreadable';
    }
}

/**
 * A recorded result for a key, or undefined.
 * @param root the repository root
 * @param key the cache key
 * @returns the result when the cache holds one
 */
export function readCached(root: string, key: string): CheckResult | undefined {
    const path = join(cacheDir(root), `${key}.json`);
    if (!existsSync(path)) return undefined;
    try {
        return JSON.parse(readFileSync(path, 'utf8')) as CheckResult;
    } catch {
        return undefined;
    }
}

/**
 * Records a result under a key. Only real runs are recorded.
 * @param root the repository root
 * @param key the cache key
 * @param result the result to record
 */
export function writeCached(root: string, key: string, result: CheckResult): void {
    const path = join(cacheDir(root), `${key}.json`);
    const status = result.status === 'cache' ? 'ok' : result.status;
    const text = JSON.stringify({ ...result, status });
    try {
        mkdirSync(cacheDir(root), { recursive: true });
        writeFileSync(path, text);
    } catch (error) {
        reportStorageFailure(path, error);
    }
}
