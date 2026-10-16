// Finds and reads repository roots, file attributes, dependency files, and scopes.
import { statSync, realpathSync } from 'node:fs';
import { openFiles } from '#cli/system/files/open.ts';
import { findScopes } from '#cli/repository/scopes.ts';
import { detectSwiftTags } from '#cli/parsers/swift.ts';
import { join, posix, dirname, resolve } from 'node:path';
import { classifyFile } from '#cli/repository/classify.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { ROOT_SCOPE } from '#cli/config/repository/scopes.ts';
import { findBlockSpan } from '#cli/system/managed-blocks.ts';
import { SWIFT_EXTENSION } from '#cli/config/parsers/swift.ts';
import { SETTINGS_FILE } from '#cli/config/system/locations.ts';
import type { SpawnResult } from '#cli/types/system/processes.ts';
import { GITATTRIBUTES_FILE } from '#cli/config/repository/tracked.ts';
import { readDependencyFiles } from '#cli/repository/dependency-files.ts';
import type { RepositoryReadOptions } from '#cli/types/repository/read.ts';
import { readCachedBytes, readCachedPrefix } from '#cli/system/files/reads.ts';
import { readIndexEntries, listTrackedFiles } from '#cli/repository/tracked.ts';
import { trimGitLine, runGitBlocking, isGitRepository } from '#cli/system/git.ts';
import type { Scope, Repository, TrackedFile } from '#cli/types/repository/inventory.ts';
import { mergeAttributes, parsePathAttributes, parseAttributePatterns } from '#cli/parsers/git.ts';

import {
    GIT_LOCALE,
    WORK_TREE_ARGUMENTS,
    NOT_REPOSITORY_CODE,
    NOT_REPOSITORY_MESSAGE,
    GIT_TOP_LEVEL_ARGUMENTS,
} from '#cli/config/system/git.ts';
import {
    SET_VALUES,
    FILE_PREFIX_BYTES,
    VENDORED_ATTRIBUTE,
    GENERATED_ATTRIBUTE,
    CHECK_ATTRIBUTES_ARGUMENTS,
} from '#cli/config/repository/inventory.ts';

/**
 * Reads attribute rules once for a repository read.
 * @param repositoryRoot the folder used as the Git working directory.
 * @param paths the tracked attribute-file paths.
 * @returns the parsed rules, or none when the optional file does not exist.
 */
function readAttributes(repositoryRoot: string, paths: string[]): Map<string, Record<string, string>> {
    if (paths.length === 0) return new Map();
    const result = runGitBlocking(repositoryRoot, CHECK_ATTRIBUTES_ARGUMENTS, {
        stdin: paths.join('\0') + '\0',
    });
    if (result.code !== 0) throw new Error(`Git could not read the attributes: ${result.stderr.trim()}`);
    return parsePathAttributes(result.stdout);
}

/**
 * Refuse broken Git metadata while allowing a folder outside any repository.
 * @param folder the folder whose top-level lookup failed.
 * @param top the failed top-level lookup.
 */
function assertOutsideGit(folder: string, top: SpawnResult): void {
    const inspection = runGitBlocking(folder, WORK_TREE_ARGUMENTS, { env: GIT_LOCALE });
    if (inspection.code !== NOT_REPOSITORY_CODE || !inspection.stderr.startsWith(NOT_REPOSITORY_MESSAGE))
        throw new Error(`Git root discovery failed in ${folder} (exit ${String(top.code)}): ${top.stderr.trim()}`);
}

/**
 * Reads tracked files, dependency files, and the written and discovered scopes.
 * @param reads the run-owned repository cache.
 * @param options the declarations, written scopes, manifests, and cached source reads.
 * @param options.declarations the generated and vendored declarations.
 * @param options.scopes the written scope entries.
 * @param options.manifests the shipped configuration manifests.
 * @returns the repository record.
 */
export async function readRepository(
    reads: ReadCache,
    { declarations, scopes, manifests }: RepositoryReadOptions,
): Promise<Repository> {
    const root = reads.root;
    const hasGit = isGitRepository(root);
    const index = hasGit ? await readIndexEntries(root) : [];
    const entries = await listTrackedFiles(root, index, { hasGit: hasGit });
    using directory = openFiles(root);
    const files: TrackedFile[] = [];
    const attributes = hasGit
        ? readAttributes(
              root,
              entries.map((entry) => entry.path),
          )
        : new Map<string, Record<string, string>>();
    for (const entry of entries) {
        const prefix = entry.symlink ? Buffer.alloc(0) : readCachedPrefix(reads, entry.path, FILE_PREFIX_BYTES);
        const file = classifyFile(root, entry, prefix, { declarations, attributes });
        if (!entry.symlink && file.kind === 'source' && file.path.endsWith(SWIFT_EXTENSION)) {
            const tags = await detectSwiftTags(file.path, readCachedBytes(reads, file.path).toString('utf8'));
            file.tags.push(...tags);
        }
        files.push(file);
    }
    const dependencyFiles = await readDependencyFiles(reads, files);
    const discovered = findScopes(files, dependencyFiles, manifests.values());
    const written: Scope[] = [
        { ...ROOT_SCOPE, configurations: [] },
        ...scopes
            .filter((entry) => directory.readStats(entry.path)?.isDirectory() === true)
            .map(
                (entry): Scope => ({
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
        files,
        dependencyFiles,
        scopes: [...new Map([...discovered, ...written].map((scope) => [scope.path, scope])).values()].toSorted(
            (left, right) => left.path.localeCompare(right.path),
        ),
    };
}

/**
 * Read generated and vendored selectors from each tracked attribute file.
 * @param reads the run's source reads.
 * @param paths tracked root-relative paths.
 * @returns the selectors declared by Git attributes.
 */
export function readLinguistPatterns(reads: ReadCache, paths: string[]): string[] {
    return [
        ...new Set(
            paths
                .filter((path) => posix.basename(path) === GITATTRIBUTES_FILE)
                .flatMap((path) => {
                    const text = readCachedBytes(reads, path).toString('utf8');
                    const span = findBlockSpan(text, { path, style: 'hash' });
                    const authored = span === undefined ? text : text.slice(0, span.start) + text.slice(span.end);
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
 * The nearest folder at or above start that holds gspot.toml, stopping at the Git top level.
 * Without settings, use the Git top level or start outside Git.
 * @param start the directory to start from.
 * @returns the settings folder, Git top level, or starting folder outside Git.
 */
export function findRoot(start: string): string {
    const folder = realpathSync(start);
    const top = runGitBlocking(folder, GIT_TOP_LEVEL_ARGUMENTS);
    const gitRoot = top.code === 0 ? resolve(trimGitLine(top.stdout)) : undefined;
    if (gitRoot === undefined) assertOutsideGit(folder, top);
    let current = folder;
    while (statSync(join(current, SETTINGS_FILE), { throwIfNoEntry: false }) === undefined) {
        if (current === gitRoot) return gitRoot;
        const parent = dirname(current);
        if (parent === current) return folder;
        current = parent;
    }
    return current;
}
