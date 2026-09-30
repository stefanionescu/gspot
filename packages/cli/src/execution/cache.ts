// .gspot/cache/: a recorded verdict keyed on the tool version, the configuration hash and the content hash of every file read.
// The folder is disposable: entries are plain files, and a run deletes those written more than a week before.
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { globPaths } from '#cli/platform/paths.ts';
import { openRoot } from '#cli/platform/filesystem.ts';
import type { CheckResult } from '#cli/types/checks.ts';
import { readSource } from '#cli/repository/tracked.ts';
import type { Read, Root } from '#cli/types/platform.ts';
import { checkResultSchema } from '#cli/checks/result.ts';
import { reportStorageFailure } from '#cli/output/messages.ts';
import type { CacheKeyInput } from '#cli/types/execution/execution.ts';
import type { SourceReads } from '#cli/types/repository/repository.ts';
import { PRIVATE_FILE, CACHE_DIRECTORY } from '#cli/config/platform.ts';
import { CACHE_FORMAT, CACHE_RETENTION_MS } from '#cli/config/execution/execution.ts';
// Whether the cache folder is a real folder. A file or a link in its place holds no results, and the write after the
// run reports it.
function hasCacheFolder(files: Root): boolean {
    try {
        return files.stat(CACHE_DIRECTORY)?.isDirectory() === true;
    } catch {
        return false;
    }
}

// The cache files written before the cutoff, read so that their removal can check they are unchanged.
function expiredEntries(files: Root, cutoff: number): { path: string; current: Read }[] {
    if (!hasCacheFolder(files)) return [];
    return files.list(CACHE_DIRECTORY).flatMap((name) => {
        const path = `${CACHE_DIRECTORY}/${name}`;
        const status = files.stat(path);
        const current = status?.isFile() === true && status.mtimeMs < cutoff ? files.read(path) : undefined;
        return current === undefined ? [] : [{ path, current }];
    });
}

/**
 * The cache key for one check run.
 * @param input the check name, scope, tool version, configuration hash and file hashes
 * @returns the key
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The result cache and its tests key a run by this one hash of its inputs and the cache format.
export function cacheKey(input: CacheKeyInput): string {
    return createHash('sha256')
        .update(JSON.stringify({ format: CACHE_FORMAT, ...input }))
        .digest('hex');
}

/**
 * The content hash of a required file.
 * @param root the repository root
 * @param path the file, relative to the root
 * @param reads the source bytes read during the run, when there are any
 * @returns the digest
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The result cache and its tests hash a file's bytes the same way.
export function fileHash(root: string, path: string, reads?: SourceReads): string {
    return createHash('sha256')
        .update(readSource(root, path, reads))
        .digest('hex');
}

/**
 * Expand declared cache inputs without traversing directories outside the repository.
 * @param root the repository root
 * @param patterns the input selectors
 * @returns the files the selectors name, relative to the root
 */
export function cacheInputs(root: string, patterns: string[]): string[] {
    const files = openRoot(root, 'native');
    try {
        const paths = globPaths(root, patterns, {
            dot: true,
            onlyFiles: true,
            followSymlinks: true,
            refuseBrokenLinks: true,
        });
        // Every named file resolves through the root boundary, which refuses a link that leaves the repository.
        for (const path of paths) files.source(path);
        return paths;
    } finally {
        files.close();
    }
}

/**
 * A recorded result for a key, or undefined. An entry that does not parse is a miss, and the run replaces it.
 * @param root the repository root
 * @param key the cache key
 * @returns the result when the cache holds one
 */
export function readCached(root: string, key: string): CheckResult | undefined {
    const path = `${CACHE_DIRECTORY}/${key}.json`;
    let file;
    try {
        const files = openRoot(root);
        try {
            if (!hasCacheFolder(files)) return undefined;
            file = files.read(path);
        } finally {
            files.close();
        }
    } catch (error) {
        throw new Error(`Could not read cached check result ${join(root, path)}: ${String(error)}`, { cause: error });
    }
    if (file === undefined) return undefined;
    let recorded: unknown;
    try {
        recorded = JSON.parse(file.bytes.toString('utf8'));
    } catch (error) {
        if (error instanceof SyntaxError) return undefined;
        throw error;
    }
    const parsed = checkResultSchema.safeParse(recorded);
    return parsed.success ? (recorded as CheckResult) : undefined;
}

/**
 * Records a result under a key. Only real runs are recorded.
 * @param root the repository root
 * @param key the cache key
 * @param result the result to record
 */
export function writeCached(root: string, key: string, result: CheckResult): void {
    const path = `${CACHE_DIRECTORY}/${key}.json`;
    const status = result.status === 'cache' ? 'ok' : result.status;
    const bytes = Buffer.from(JSON.stringify({ ...result, status }));
    try {
        const files = openRoot(root);
        try {
            files.write(path, { bytes, mode: PRIVATE_FILE }, files.read(path));
        } finally {
            files.close();
        }
    } catch (error) {
        reportStorageFailure(join(root, path), error);
    }
}

/**
 * Deletes every file of the cache folder written more than a week ago.
 * @param root the repository root
 */
export function pruneCache(root: string): void {
    const cutoff = Date.now() - CACHE_RETENTION_MS;
    try {
        const files = openRoot(root);
        try {
            for (const { path, current } of expiredEntries(files, cutoff)) files.remove(path, current);
        } finally {
            files.close();
        }
    } catch (error) {
        reportStorageFailure(join(root, CACHE_DIRECTORY), error);
    }
}
