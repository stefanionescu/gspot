import { globbySync } from 'globby';
import { join, relative } from 'node:path';
import { readSource } from '#cli/repository/tracked.ts';
import { checkResultSchema } from '#cli/checks/result.ts';
import { CACHE_DIRECTORY } from '#cli/constants/platform.ts';
import { readdirSync, statSync, type Dirent } from 'node:fs';
import type { CheckResult } from '#cli/types/checks/checks.ts';
// .gspot/cache/: a recorded verdict keyed on the tool version, the configuration hash and the content hash of every file read.
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { reportStorageFailure } from '#cli/output/messages.ts';
import type { CacheKeyInput } from '#cli/types/execution/execution.ts';
import type { SourceObservations } from '#cli/types/repository/repository.ts';
import { readOwnership, withLifecycleOwner } from '#cli/lifecycle/ownership.ts';
import { CACHE_ENTRY, CACHE_FORMAT, RETENTION_MS } from '#cli/constants/execution/execution.ts';

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
 * @param observations the source bytes observed during the run, when there are any
 * @returns the digest
 */
export function fileHash(root: string, path: string, observations?: SourceObservations): string {
    return new Bun.CryptoHasher('sha256').update(readSource(root, path, observations)).digest('hex');
}

/**
 * Expand declared cache inputs without traversing directories outside the repository.
 * @param root the repository root
 * @param patterns the input selectors
 * @returns the files the selectors name, relative to the root
 */
export function cacheInputs(root: string, patterns: string[]): string[] {
    const files = openConfinedRoot(root, 'native');
    const localPath = (path: string): string => relative(root, path).replaceAll('\\', '/');
    function readDirectory(path: string): string[];
    function readDirectory(path: string, options: { withFileTypes: true }): Dirent[];
    function readDirectory(path: string, options?: { withFileTypes: true }): string[] | Dirent[] {
        const local = localPath(path);
        if (local !== '') files.stat(local);
        return options === undefined ? readdirSync(path) : readdirSync(path, options);
    }
    try {
        return globbySync(patterns, {
            cwd: root,
            dot: true,
            onlyFiles: true,
            followSymbolicLinks: true,
            throwErrorOnBrokenSymbolicLink: true,
            gitignore: false,
            expandDirectories: false,
            fs: {
                readdirSync: readDirectory,
                statSync: (path) => statSync(localPath(path) === '' ? root : files.source(localPath(path))),
            },
        });
    } finally {
        files.close();
    }
}

/**
 * A recorded result for a key, or undefined.
 * @param root the repository root
 * @param key the cache key
 * @returns the result when the cache holds one
 */
export function readCached(root: string, key: string): CheckResult | undefined {
    const path = join(join(root, CACHE_DIRECTORY), `${key}.json`);
    try {
        const relative = `${CACHE_DIRECTORY}/${key}.json`;
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
        checkResultSchema.parse(result);
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
    const path = join(join(root, CACHE_DIRECTORY), `${key}.json`);
    const status = result.status === 'cache' ? 'ok' : result.status;
    const text = JSON.stringify({ ...result, status });
    try {
        withLifecycleOwner(root, (owner) => {
            const status = owner.replace(
                `${CACHE_DIRECTORY}/${key}.json`,
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
            const files = openConfinedRoot(root);
            const proposals = readOwnership(root)
                .files.filter((entry) => entry.kind === 'runtime' && CACHE_ENTRY.test(entry.path))
                .filter((entry) => {
                    const status = files.stat(entry.path);
                    return status !== undefined && status.isFile() && status.mtimeMs < cutoff;
                })
                .map((entry) => owner.proposeRestoration(entry.path))
                .filter((proposal) => proposal.status !== 'preserved');
            owner.applyProposals(proposals);
        });
    } catch (error) {
        reportStorageFailure(join(root, CACHE_DIRECTORY), error);
    }
}
