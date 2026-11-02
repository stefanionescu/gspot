import { realpathSync } from 'node:fs';
import { posix, resolve } from 'node:path';
import { compareText } from '#cli/system/text.ts';
import { GspotError } from '#cli/system/errors.ts';
import type { RunCache } from '#cli/types/system.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { SWIFT_EXTENSION } from '#cli/config/parsers.ts';
import { detectSwiftTags } from '#cli/parsers/code/swift.ts';
import { detectScopeFolders } from '#cli/repository/scopes.ts';
import { gitIndexFileSchema } from '#cli/schemas/repository.ts';
import { classifyFile } from '#cli/repository/files/classify.ts';
import { stripBlock } from '#cli/parsers/formats/managed-blocks.ts';
import { runGit, isNotRepository } from '#cli/repository/git/run.ts';
import { readDependencyFiles } from '#cli/repository/dependencies.ts';
import { readText, findText, readBytes } from '#cli/system/files/reads.ts';
import { listGitFiles, listTrackedFiles } from '#cli/repository/files/tracked.ts';
import { INDEX_LINE, GIT_LOCALE, TRAILING_NEWLINE, GIT_TOP_LEVEL_ARGUMENTS } from '#cli/config/repository/git.ts';

import {
    mergeAttributes,
    parseListingLine,
    parsePathAttributes,
    parseAttributePatterns,
} from '#cli/repository/git/output.ts';
import type {
    Repository,
    ScopeFolder,
    TrackedFile,
    RepositoryListing,
    RepositoryReadOptions,
} from '#cli/types/repository.ts';
import {
    SET_VALUES,
    ROOT_SCOPE,
    SETTINGS_FILE,
    NEEDS_GIT_MESSAGE,
    FILE_PREFIX_BYTES,
    GITATTRIBUTES_FILE,
    VENDORED_ATTRIBUTE,
    GENERATED_ATTRIBUTE,
    GIT_INDEX_FILES_ARGUMENTS,
    GIT_UNTRACKED_FILES_ARGUMENTS,
    GIT_CHECK_ATTRIBUTES_ARGUMENTS,
} from '#cli/config/repository/files.ts';

async function readAttributes(root: string, paths: string[]): Promise<Map<string, Record<string, string>>> {
    if (paths.length === 0) return new Map();
    const result = await runGit(root, GIT_CHECK_ATTRIBUTES_ARGUMENTS, {
        stdin: paths.join('\0') + '\0',
    });
    if (result.code !== 0) throw new GspotError('git', `Git could not read the attributes: ${result.stderr.trim()}`);
    return parsePathAttributes(result.stdout);
}

/**
List the tracked files and the untracked files that Git does not ignore. Each file comes with its first bytes and its Git
attributes.

@param cache the run cache.
*/
export async function listRepositoryFiles(cache: RunCache): Promise<RepositoryListing> {
    const root = cache.root;
    const unreadablePaths: string[] = [];
    const [indexed, untracked] = await Promise.all([
        listGitFiles(root, GIT_INDEX_FILES_ARGUMENTS, undefined, unreadablePaths),
        listGitFiles(root, GIT_UNTRACKED_FILES_ARGUMENTS, undefined, unreadablePaths),
    ]);
    const index = indexed
        .split('\0')
        .filter(Boolean)
        .map((line) => parseListingLine(INDEX_LINE.exec(line), gitIndexFileSchema));
    const listedFiles = listTrackedFiles(root, index, untracked);
    const attributes = await readAttributes(
        root,
        listedFiles.map((file) => file.path),
    );
    const files = listedFiles.map((listedFile) => ({
        ...listedFile,
        prefix: listedFile.isSymlink
            ? Buffer.alloc(0)
            : readBytes(cache, listedFile.path, { limit: FILE_PREFIX_BYTES }),
    }));
    return { root, index, attributes, files, unreadablePaths: unreadablePaths.toSorted(compareText) };
}

/**
Classify the listed files, and read the dependency files and the written and discovered scopes.

@param cache the run cache.
@param listing the files that listRepositoryFiles found.
@param options what the read needs.
@param options.generatedPaths the generated and vendored path rules.
@param options.scopes the written scope tables.
@param options.configurationsByName the shipped configurations.
*/
export async function readRepository(
    cache: RunCache,
    listing: RepositoryListing,
    { generatedPaths, scopes, configurationsByName }: RepositoryReadOptions,
): Promise<Repository> {
    const { root, index, attributes, unreadablePaths } = listing;
    const files = openFiles(root);
    const tracked: TrackedFile[] = [];
    for (const listedFile of listing.files) {
        const file = classifyFile(root, listedFile, listedFile.prefix, { generatedPaths, attributes });
        if (!listedFile.isSymlink && file.kind === 'source' && file.path.endsWith(SWIFT_EXTENSION)) {
            const tags = await detectSwiftTags(file.path, readText(cache, file.path));
            file.tags.push(...tags);
        }
        tracked.push(file);
    }
    const dependencyFiles = await readDependencyFiles(cache, tracked);
    const discovered = detectScopeFolders(tracked, dependencyFiles, configurationsByName.values());
    const written: ScopeFolder[] = [
        { ...ROOT_SCOPE, configurations: [] },
        ...scopes
            .filter((each) => files.findStats(each.path)?.isDirectory() === true)
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
        unreadablePaths,
        index,
        files: tracked,
        dependencyFiles,
        scopeFolders: new Map([...discovered, ...written].map((scope) => [scope.path, scope]))
            .values()
            .toArray()
            .toSorted((left, right) => compareText(left.path, right.path)),
    };
}

/**
Read generated and vendored selectors from each tracked attribute file.

@param cache the run cache.
@param paths the tracked root-relative files.
*/
export function readLinguistPatterns(cache: RunCache, paths: string[]): string[] {
    return [
        ...new Set(
            paths
                .filter((path) => posix.basename(path) === GITATTRIBUTES_FILE)
                .flatMap((path) => {
                    const authored = stripBlock(findText(cache, path) ?? '', { path });
                    return parseAttributePatterns(authored, posix.dirname(path))
                        .filter((rule) =>
                            Object.entries(mergeAttributes(rule.attributes)).some(
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
Read the canonical worktree root from Git.

@param start where the command starts.
*/
export async function readRepositoryRoot(start: string): Promise<string> {
    const folder = realpathSync(start);
    const top = await runGit(folder, GIT_TOP_LEVEL_ARGUMENTS, { env: GIT_LOCALE });
    if (top.code === 0) return resolve(top.stdout.replace(TRAILING_NEWLINE, ''));
    if (isNotRepository(top)) throw new GspotError('git', NEEDS_GIT_MESSAGE);
    if (top.stderr.includes('must be run in a work tree'))
        throw new GspotError(
            'git',
            `${folder} is a bare repository or a Git folder, not a work tree. Run gspot in the work tree.`,
        );
    throw new GspotError('git', `Git could not open ${folder}: ${top.stderr.trim()}`);
}
