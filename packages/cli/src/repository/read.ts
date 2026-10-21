// Finds and reads repository roots, file attributes, dependency files, and scopes.
import { statSync, realpathSync } from 'node:fs';
import { openFiles } from '#cli/system/files/open.ts';
import { join, posix, dirname, resolve } from 'node:path';
import { SETTINGS_FILE } from '#cli/config/gspot-paths.ts';
import { stripBlock } from '#cli/parsers/managed-blocks.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { findScopeFolders } from '#cli/repository/scopes.ts';
import { ROOT_SCOPE } from '#cli/config/repository/scopes.ts';
import { detectSwiftTags } from '#cli/repository/swift-tags.ts';
import { classifyFile } from '#cli/repository/files/classify.ts';
import { runGitBlocking, isGitRepository } from '#cli/system/git.ts';
import { GITATTRIBUTES_FILE } from '#cli/config/repository/tracked.ts';
import { readDependencyFiles } from '#cli/repository/dependency-files.ts';
import type { RepositoryReadOptions } from '#cli/types/repository/read.ts';
import { readCachedText, readCachedPrefix } from '#cli/system/files/reads.ts';
import { listTrackedFiles, readIndexEntries } from '#cli/repository/files/tracked.ts';
import type { Repository, ScopeFolder, TrackedFile } from '#cli/types/repository/inventory.ts';
import { mergeAttributes, parsePathAttributes, parseAttributePatterns } from '#cli/parsers/git.ts';

import {
    GIT_LOCALE,
    TRAILING_NEWLINE,
    NOT_REPOSITORY_CODE,
    NOT_REPOSITORY_MESSAGE,
    GIT_TOP_LEVEL_ARGUMENTS,
    GIT_WORK_TREE_ARGUMENTS,
} from '#cli/config/system/git.ts';
import {
    SET_VALUES,
    SWIFT_EXTENSION,
    FILE_PREFIX_BYTES,
    VENDORED_ATTRIBUTE,
    GENERATED_ATTRIBUTE,
    GIT_CHECK_ATTRIBUTES_ARGUMENTS,
} from '#cli/config/repository/inventory.ts';

/**
 * Read the attribute rules once per repository read.
 *
 * @param repositoryRoot the folder where Git runs.
 * @param paths the tracked .gitattributes files.
 * @returns the parsed rules, or none when the optional file does not exist.
 */
function readAttributes(repositoryRoot: string, paths: string[]): Map<string, Record<string, string>> {
    if (paths.length === 0) return new Map();
    const result = runGitBlocking(repositoryRoot, GIT_CHECK_ATTRIBUTES_ARGUMENTS, {
        stdin: paths.join('\0') + '\0',
    });
    if (result.code !== 0) throw new Error(`Git could not read the attributes: ${result.stderr.trim()}`);
    return parsePathAttributes(result.stdout);
}

/**
 * Read the tracked files, dependency files, and the written and discovered scopes.
 *
 * @param reads the run cache.
 * @param options what the read needs.
 * @param options.generatedPaths the generated and vendored path rules.
 * @param options.scopes the written scope tables.
 * @param options.configurations the shipped configurations.
 * @returns the repository inventory.
 */
export async function readRepository(
    reads: ReadCache,
    { generatedPaths, scopes, configurations }: RepositoryReadOptions,
): Promise<Repository> {
    const root = reads.root;
    const hasGit = isGitRepository(root);
    const index = hasGit ? await readIndexEntries(root) : [];
    const entries = await listTrackedFiles(root, index, { hasGit });
    using files = openFiles(root);
    const tracked: TrackedFile[] = [];
    const attributes = hasGit
        ? readAttributes(
              root,
              entries.map((entry) => entry.path),
          )
        : new Map<string, Record<string, string>>();
    for (const entry of entries) {
        const prefix = entry.symlink ? Buffer.alloc(0) : readCachedPrefix(reads, entry.path, FILE_PREFIX_BYTES);
        const file = classifyFile(root, entry, prefix, { generatedPaths, attributes });
        if (!entry.symlink && file.kind === 'source' && file.path.endsWith(SWIFT_EXTENSION)) {
            const tags = await detectSwiftTags(file.path, readCachedText(reads, file.path));
            file.tags.push(...tags);
        }
        tracked.push(file);
    }
    const dependencyFiles = await readDependencyFiles(reads, tracked);
    const discovered = findScopeFolders(tracked, dependencyFiles, configurations.values());
    const written: ScopeFolder[] = [
        { ...ROOT_SCOPE, configurations: [] },
        ...scopes
            .filter((entry) => files.readStats(entry.path)?.isDirectory() === true)
            .map(
                (entry): ScopeFolder => ({
                    path: entry.path,
                    configurations: entry.configurations,
                    origin: SETTINGS_FILE,
                }),
            ),
    ];
    return {
        root,
        attributes,
        index,
        hasGit,
        files: tracked,
        dependencyFiles,
        scopeFolders: [...new Map([...discovered, ...written].map((scope) => [scope.path, scope])).values()].toSorted(
            (left, right) => left.path.localeCompare(right.path),
        ),
    };
}

/**
 * Read generated and vendored selectors from each tracked attribute file.
 *
 * @param reads the run cache.
 * @param paths the tracked root-relative files.
 * @returns the selectors declared by Git attributes.
 */
export function readLinguistPatterns(reads: ReadCache, paths: string[]): string[] {
    return [
        ...new Set(
            paths
                .filter((path) => posix.basename(path) === GITATTRIBUTES_FILE)
                .flatMap((path) => {
                    const text = readCachedText(reads, path);
                    const authored = stripBlock(text, { path, style: 'hash' });
                    return parseAttributePatterns(authored, posix.dirname(path))
                        .filter((rule) =>
                            Object.entries(mergeAttributes(rule.attributes, {})).some(
                                ([name, value]) =>
                                    (name === GENERATED_ATTRIBUTE || name === VENDORED_ATTRIBUTE) &&
                                    SET_VALUES.has(value),
                            ),
                        )
                        .map((rule) => rule.pattern);
                }),
        ),
    ];
}

/**
 * Find the Git top level, or the nearest settings folder outside Git.
 * Without settings outside Git, return the starting folder.
 *
 * @param start where the search begins.
 * @returns the settings folder, Git top level, or starting folder outside Git.
 */
export function findRoot(start: string): string {
    const folder = realpathSync(start);
    const top = runGitBlocking(folder, GIT_TOP_LEVEL_ARGUMENTS);
    const gitRoot = top.code === 0 ? resolve(top.stdout.replace(TRAILING_NEWLINE, '')) : undefined;
    if (gitRoot !== undefined) return gitRoot;
    // Broken Git metadata stops the search; a folder outside any repository does not.
    const inspection = runGitBlocking(folder, GIT_WORK_TREE_ARGUMENTS, { env: GIT_LOCALE });
    if (inspection.code !== NOT_REPOSITORY_CODE || !inspection.stderr.startsWith(NOT_REPOSITORY_MESSAGE))
        throw new Error(`Git root discovery failed in ${folder} (exit ${String(top.code)}): ${top.stderr.trim()}`);
    let current = folder;
    while (statSync(join(current, SETTINGS_FILE), { throwIfNoEntry: false }) === undefined) {
        const parent = dirname(current);
        if (parent === current) return folder;
        current = parent;
    }
    return current;
}
