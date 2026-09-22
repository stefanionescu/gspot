// .gspot/cache/: a recorded verdict keyed on the tool version, the configuration hash and the content hash of every file read.
import { join } from 'node:path';
import type { CacheKeyInput } from '#cli/run/types.ts';
import type { CheckResult } from '#cli/output/finding.ts';
import { reportSchema } from '#cli/run/report-schema.ts';
import { reportStorageFailure } from '#cli/output/messages.ts';
import { lstatSync, readFileSync } from 'node:fs';
import { openConfinedRoot } from '#cli/lifecycle/confined.ts';
import { readOwnership, withLifecycleOwner } from '#cli/lifecycle/ownership.ts';

const CACHE_FORMAT = 5;
// Thirty days in milliseconds.
const RETENTION_MS = 2_592_000_000;
const CACHE_ENTRY = /^\.gspot\/cache\/[a-f0-9]{64}\.json$/u;

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
    return textHash(JSON.stringify({ format: CACHE_FORMAT, ...input }));
}

/**
 * The content hash of a required file.
 * @param root the repository root
 * @param path the file, relative to the root
 * @returns the digest
 */
export function fileHash(root: string, path: string): string {
    return new Bun.CryptoHasher('sha256').update(readFileSync(join(root, path))).digest('hex');
}

/**
 * A recorded result for a key, or undefined.
 * @param root the repository root
 * @param key the cache key
 * @returns the result when the cache holds one
 */
export function readCached(root: string, key: string): CheckResult | undefined {
    const path = join(join(root, '.gspot', 'cache'), `${key}.json`);
    try {
        const relative = `.gspot/cache/${key}.json`;
        const recorded = readOwnership(root).files.find((entry) => entry.path === relative && entry.kind === 'runtime');
        if (recorded?.installed === undefined) return undefined;
        const confined = openConfinedRoot(root);
        let file;
        try {
            file = confined.read(relative);
        } finally {
            confined.close();
        }
        if (
            file?.mode !== recorded.installed.mode ||
            new Bun.CryptoHasher('sha256').update(file.bytes).digest('hex') !== recorded.installed.hash
        )
            return undefined;
        const result: unknown = JSON.parse(file.bytes.toString('utf8'));
        reportSchema.shape.checks.element.parse(result);
        return result as CheckResult;
    } catch (error) {
        throw new Error(`Could not read cached check result ${path}: ${String(error)}`, { cause: error });
    }
}

/**
 * Records a result under a key. Only real runs are recorded.
 * @param root the repository root
 * @param key the cache key
 * @param result the result to record
 */
export function writeCached(root: string, key: string, result: CheckResult): void {
    const path = join(join(root, '.gspot', 'cache'), `${key}.json`);
    const status = result.status === 'cache' ? 'ok' : result.status;
    const text = JSON.stringify({ ...result, status });
    try {
        withLifecycleOwner(root, (owner) => {
            const status = owner.replace(
                `.gspot/cache/${key}.json`,
                { bytes: Buffer.from(text), mode: 0o600 },
                'runtime',
            );
            if (status === 'preserved') throw new Error(`Preserved edited or unowned cache result ${path}.`);
        });
    } catch (error) {
        reportStorageFailure(path, error);
    }
}

/**
 * Retire expired, recorded cache results without removing authored or subsequently edited files.
 * @param root the repository root
 */
export function pruneCache(root: string): void {
    const cutoff = Date.now() - RETENTION_MS;
    try {
        withLifecycleOwner(root, (owner) => {
            const proposals = readOwnership(root)
                .files.filter((entry) => entry.kind === 'runtime' && CACHE_ENTRY.test(entry.path))
                .filter((entry) => {
                    const status = lstatSync(join(root, entry.path), { throwIfNoEntry: false });
                    return status !== undefined && status.isFile() && status.mtimeMs < cutoff;
                })
                .map((entry) => owner.proposeRestoration(entry.path))
                .filter((proposal) => proposal.status !== 'preserved');
            owner.applyProposals(proposals);
        });
    } catch (error) {
        reportStorageFailure(join(root, '.gspot', 'cache'), error);
    }
}
