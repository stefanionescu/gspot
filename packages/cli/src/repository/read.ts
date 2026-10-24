import { statSync, realpathSync } from 'node:fs';
import { compareText } from '#cli/system/text.ts';
import { GspotError } from '#cli/system/errors.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { join, posix, dirname, resolve } from 'node:path';
import type { ReadCache } from '#cli/types/system/files.ts';
import { SETTINGS_FILE } from '#cli/config/settings/file.ts';
import { findScopeFolders } from '#cli/repository/scopes.ts';
import { ROOT_SCOPE } from '#cli/config/repository/scopes.ts';
import { classifyFile } from '#cli/repository/files/classify.ts';
import { stripBlock } from '#cli/parsers/formats/managed-blocks.ts';
import { runGitBlocking, isGitRepository } from '#cli/system/git.ts';
import { readDependencyFiles } from '#cli/repository/dependencies.ts';
import { detectSwiftTags } from '#cli/repository/files/swift-tags.ts';
import type { RepositoryReadOptions } from '#cli/types/repository/read.ts';
import { readCachedText, readCachedPrefix } from '#cli/system/files/reads.ts';
import { SWIFT_EXTENSION, GITATTRIBUTES_FILE } from '#cli/config/files/names.ts';
import { readIndexFiles, listTrackedFiles } from '#cli/repository/files/tracked.ts';
import type { Repository, ScopeFolder, TrackedFile } from '#cli/types/repository/files.ts';
import { FILE_PREFIX_BYTES, GIT_CHECK_ATTRIBUTES_ARGUMENTS } from '#cli/config/repository/read.ts';
import { mergeAttributes, parsePathAttributes, parseAttributePatterns } from '#cli/parsers/git.ts';
import { SET_VALUES, VENDORED_ATTRIBUTE, GENERATED_ATTRIBUTE } from '#cli/config/repository/files/classify.ts';

import {
    GIT_LOCALE,
    TRAILING_NEWLINE,
    NOT_REPOSITORY_CODE,
    NOT_REPOSITORY_MESSAGE,
    GIT_TOP_LEVEL_ARGUMENTS,
} from '#cli/config/system/git.ts';

function readAttributes(repositoryRoot: string, paths: string[]): Map<string, Record<string, string>> {
    if (paths.length === 0) return new Map();
    const result = runGitBlocking(repositoryRoot, GIT_CHECK_ATTRIBUTES_ARGUMENTS, {
        stdin: paths.join('\0') + '\0',
    });
    if (result.code !== 0) throw new GspotError('git', `Git could not read the attributes: ${result.stderr.trim()}`);
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
    const index = hasGit ? await readIndexFiles(root) : [];
    const listedFiles = await listTrackedFiles(root, index, { hasGit });
    using files = openFiles(root);
    const tracked: TrackedFile[] = [];
    const attributes = hasGit
        ? readAttributes(
              root,
              listedFiles.map((listedFile) => listedFile.path),
          )
        : new Map<string, Record<string, string>>();
    for (const listedFile of listedFiles) {
        const prefix = listedFile.symlink
            ? Buffer.alloc(0)
            : readCachedPrefix(reads, listedFile.path, FILE_PREFIX_BYTES);
        const file = classifyFile(root, listedFile, prefix, { generatedPaths, attributes });
        if (!listedFile.symlink && file.kind === 'source' && file.path.endsWith(SWIFT_EXTENSION)) {
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
            .filter((each) => files.readStats(each.path)?.isDirectory() === true)
            .map(
                (each): ScopeFolder => ({
                    path: each.path,
                    configurations: each.configurations,
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
            (left, right) => compareText(left.path, right.path),
        ),
    };
}

/**
 * Read generated and vendored selectors from each tracked attribute file.
 *
 * @param reads the run cache.
 * @param paths the tracked root-relative files.
 * @returns the selectors that Git attributes declare.
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
    const top = runGitBlocking(folder, GIT_TOP_LEVEL_ARGUMENTS, { env: GIT_LOCALE });
    if (top.code === 0) return resolve(top.stdout.replace(TRAILING_NEWLINE, ''));
    if (top.code !== NOT_REPOSITORY_CODE || !top.stderr.startsWith(NOT_REPOSITORY_MESSAGE))
        throw new GspotError('git', `Git could not open ${folder}: ${top.stderr.trim()}`);
    let walked = folder;
    while (statSync(join(walked, SETTINGS_FILE), { throwIfNoEntry: false }) === undefined) {
        const parent = dirname(walked);
        if (parent === walked) return folder;
        walked = parent;
    }
    return walked;
}
