import { statSync, realpathSync } from 'node:fs';
import { compareText } from '#cli/system/text.ts';
import { GspotError } from '#cli/system/errors.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { INDEX_LINE } from '#cli/config/parsers/git.ts';
import { join, posix, dirname, resolve } from 'node:path';
import { type ReadCache } from '#cli/types/system/files.ts';
import { SETTINGS_FILE } from '#cli/config/settings/file.ts';
import { detectSwiftTags } from '#cli/parsers/code/swift.ts';
import { detectScopeFolders } from '#cli/repository/scopes.ts';
import { classifyFile } from '#cli/repository/files/classify.ts';
import { gitIndexFileSchema } from '#cli/schemas/parsers/git.ts';
import { stripBlock } from '#cli/parsers/formats/managed-blocks.ts';
import { readDependencyFiles } from '#cli/repository/dependencies.ts';
import { SWIFT_EXTENSION, GITATTRIBUTES_FILE } from '#cli/config/files/names.ts';
import { listGitFiles, listTrackedFiles } from '#cli/repository/files/tracked.ts';
import { GIT_INDEX_FILES_ARGUMENTS } from '#cli/config/repository/files/tracked.ts';
import { runGitBlocking, isGitRepository, isNotRepository } from '#cli/system/git.ts';
import { findCachedText, readCachedText, readCachedPrefix } from '#cli/system/files/reads.ts';
import { GIT_LOCALE, TRAILING_NEWLINE, GIT_TOP_LEVEL_ARGUMENTS } from '#cli/config/system/git.ts';
import { type RepositoryListing, type RepositoryReadOptions } from '#cli/types/repository/read.ts';
import { type Repository, type ScopeFolder, type TrackedFile } from '#cli/types/repository/files.ts';
import { SET_VALUES, VENDORED_ATTRIBUTE, GENERATED_ATTRIBUTE } from '#cli/config/repository/files/classify.ts';
import { ROOT_SCOPE, FILE_PREFIX_BYTES, GIT_CHECK_ATTRIBUTES_ARGUMENTS } from '#cli/config/repository/read.ts';
import { mergeAttributes, parseListingLine, parsePathAttributes, parseAttributePatterns } from '#cli/parsers/git.ts';

function readAttributes(root: string, paths: string[]): Map<string, Record<string, string>> {
    if (paths.length === 0) return new Map();
    const result = runGitBlocking(root, GIT_CHECK_ATTRIBUTES_ARGUMENTS, {
        stdin: paths.join('\0') + '\0',
    });
    if (result.code !== 0) throw new GspotError('git', `Git could not read the attributes: ${result.stderr.trim()}`);
    return parsePathAttributes(result.stdout);
}

/**
List the tracked files and the untracked files that Git does not ignore. Each file comes with its first bytes and its Git
attributes.

@param reads the run cache.
*/
export async function listRepositoryFiles(reads: ReadCache): Promise<RepositoryListing> {
    const root = reads.root;
    const hasGit = isGitRepository(root);
    const unreadablePaths: string[] = [];
    const index = hasGit
        ? await listGitFiles(root, GIT_INDEX_FILES_ARGUMENTS, undefined, unreadablePaths).then((listed) =>
              listed
                  .split('\0')
                  .filter(Boolean)
                  .map((line) => parseListingLine(INDEX_LINE.exec(line), gitIndexFileSchema)),
          )
        : [];
    const listedFiles = await listTrackedFiles(root, index, { hasGit, unreadablePaths });
    const attributes = hasGit
        ? readAttributes(
              root,
              listedFiles.map((listedFile) => listedFile.path),
          )
        : new Map<string, Record<string, string>>();
    const files = listedFiles.map((listedFile) => ({
        ...listedFile,
        prefix: listedFile.isSymlink ? Buffer.alloc(0) : readCachedPrefix(reads, listedFile.path, FILE_PREFIX_BYTES),
    }));
    return { root, hasGit, index, attributes, files, unreadablePaths };
}

/**
Classify the listed files, and read the dependency files and the written and discovered scopes.

@param reads the run cache.
@param listing the files that listRepositoryFiles found.
@param options what the read needs.
@param options.generatedPaths the generated and vendored path rules.
@param options.scopes the written scope tables.
@param options.configurationsByName the shipped configurations.
*/
export async function readRepository(
    reads: ReadCache,
    listing: RepositoryListing,
    { generatedPaths, scopes, configurationsByName }: RepositoryReadOptions,
): Promise<Repository> {
    const { root, hasGit, index, attributes, unreadablePaths } = listing;
    const files = openFiles(root);
    const tracked: TrackedFile[] = [];
    for (const listedFile of listing.files) {
        const file = classifyFile(root, listedFile, listedFile.prefix, { generatedPaths, attributes });
        if (!listedFile.isSymlink && file.kind === 'source' && file.path.endsWith(SWIFT_EXTENSION)) {
            const tags = await detectSwiftTags(file.path, readCachedText(reads, file.path));
            file.tags.push(...tags);
        }
        tracked.push(file);
    }
    const dependencyFiles = await readDependencyFiles(reads, tracked);
    const discovered = detectScopeFolders(tracked, dependencyFiles, configurationsByName.values());
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
        unreadablePaths,
        index,
        hasGit,
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

@param reads the run cache.
@param paths the tracked root-relative files.
*/
export function readLinguistPatterns(reads: ReadCache, paths: string[]): string[] {
    return [
        ...new Set(
            paths
                .filter((path) => posix.basename(path) === GITATTRIBUTES_FILE)
                .flatMap((path) => {
                    const authored = stripBlock(findCachedText(reads, path) ?? '', { path });
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
Read the top level from Git, or find the nearest settings folder outside a repository.
Without settings outside Git, return the starting folder.

@param start where the search begins.
@returns the settings folder, Git top level, or starting folder outside Git.
*/
export function readRepositoryRoot(start: string): string {
    const folder = realpathSync(start);
    const top = runGitBlocking(folder, GIT_TOP_LEVEL_ARGUMENTS, { env: GIT_LOCALE });
    if (top.code === 0) return resolve(top.stdout.replace(TRAILING_NEWLINE, ''));
    if (!isNotRepository(top)) throw new GspotError('git', `Git could not open ${folder}: ${top.stderr.trim()}`);
    let walked = folder;
    while (statSync(join(walked, SETTINGS_FILE), { throwIfNoEntry: false }) === undefined) {
        const parent = dirname(walked);
        if (parent === walked) return folder;
        walked = parent;
    }
    return walked;
}
