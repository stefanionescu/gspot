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
import { GITATTRIBUTES_FILE } from '#cli/config/repository/tracked.ts';
import { readDependencyFiles } from '#cli/repository/dependency-files.ts';
import type { RepositoryReadOptions } from '#cli/types/repository/read.ts';
import { readCachedBytes, readCachedPrefix } from '#cli/system/files/reads.ts';
import { readIndexEntries, listTrackedFiles } from '#cli/repository/tracked.ts';
import type { Repository, ScopeEntry, TrackedFile } from '#cli/types/repository/inventory.ts';
import { trimGitLine, isOutsideGit, runGitBlocking, isGitRepository } from '#cli/system/git.ts';
import { mergeAttributes, parsePathAttributes, parseAttributePatterns } from '#cli/parsers/git.ts';
import { GIT_LOCALE, WORK_TREE_ARGUMENTS, GIT_TOP_LEVEL_ARGUMENTS } from '#cli/config/system/git.ts';

import {
    SET_VALUES,
    FILE_PREFIX_BYTES,
    VENDORED_ATTRIBUTE,
    GENERATED_ATTRIBUTE,
    CHECK_ATTRIBUTES_ARGUMENTS,
} from '#cli/config/repository/inventory.ts';

/**
 * Reads attribute rules once for a repository read.
 * @param root the repository root.
 * @param paths the tracked attribute-file paths.
 * @returns the parsed rules, or none when the optional file does not exist.
 */
function readAttributes(root: string, paths: string[]): Map<string, Record<string, string>> {
    if (paths.length === 0) return new Map();
    const result = runGitBlocking(root, [...CHECK_ATTRIBUTES_ARGUMENTS], {
        stdin: paths.join('\0') + '\0',
    });
    if (result.code !== 0) throw new Error(`Git could not read the attributes: ${result.stderr.trim()}`);
    return parsePathAttributes(result.stdout);
}

/**
 * Reads tracked files, dependency files, and the written and discovered scopes.
 * @param reads the run-owned repository cache.
 * @param options the declarations, written scopes, manifests, and cached source reads.
 * @param options.declarations the generated and vendored declarations.
 * @param options.scopeEntries the written scope entries.
 * @param options.manifests the shipped configuration manifests.
 * @returns the repository record.
 */
export async function readRepository(
    reads: ReadCache,
    { declarations, scopeEntries, manifests }: RepositoryReadOptions,
): Promise<Repository> {
    const root = reads.root;
    const hasGit = isGitRepository(root);
    const index = hasGit ? await readIndexEntries(root) : [];
    const entries = await listTrackedFiles(root, index, hasGit);
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
    const written: ScopeEntry[] = [
        { ...ROOT_SCOPE, configurations: [] },
        ...scopeEntries
            .filter((entry) => directory.stat(entry.path)?.isDirectory() === true)
            .map(
                (entry): ScopeEntry => ({
                    path: entry.path,
                    configurations: entry.configurations,
                    source: SETTINGS_FILE,
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
                                    new Set<string>(SET_VALUES).has(value),
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
 * @returns the root.
 */
export function findRoot(start: string): string {
    const folder = realpathSync(start);
    const top = runGitBlocking(folder, [...GIT_TOP_LEVEL_ARGUMENTS]);
    const gitRoot = top.code === 0 ? resolve(trimGitLine(top.stdout)) : undefined;
    if (gitRoot === undefined && !isOutsideGit(runGitBlocking(folder, WORK_TREE_ARGUMENTS, { env: GIT_LOCALE })))
        throw new Error(`Git root discovery failed in ${folder} (exit ${String(top.code)}): ${top.stderr.trim()}`);
    let current = folder;
    while (statSync(join(current, SETTINGS_FILE), { throwIfNoEntry: false }) === undefined) {
        if (current === gitRoot) return gitRoot;
        const parent = dirname(current);
        if (parent === current) return folder;
        current = parent;
    }
    return current;
}
