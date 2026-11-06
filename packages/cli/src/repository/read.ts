import { realpathSync } from 'node:fs';
import { posix, resolve } from 'node:path';

import { SWIFT_EXTENSION } from '#cli/config/parsers.ts';
import {
    FILE_PREFIX_BYTES,
    GENERATED_ATTRIBUTE,
    GIT_CHECK_ATTRIBUTES_ARGUMENTS,
    GIT_INDEX_FILES_ARGUMENTS,
    GIT_UNTRACKED_FILES_ARGUMENTS,
    GITATTRIBUTES_FILE,
    NEEDS_GIT_MESSAGE,
    ROOT_SCOPE,
    SET_VALUES,
    SETTINGS_FILE,
    VENDORED_ATTRIBUTE,
} from '#cli/config/repository/files.ts';
import { GIT_LOCALE, GIT_TOP_LEVEL_ARGUMENTS, INDEX_LINE, TRAILING_NEWLINE } from '#cli/config/repository/git.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { detectSwiftTags } from '#cli/parsers/code/swift.ts';
import { stripBlock } from '#cli/parsers/formats/managed-blocks.ts';
import { readDependencyFiles } from '#cli/repository/dependencies.ts';
import { classifyFile } from '#cli/repository/files/classify.ts';
import { listTrackedFiles, readGitListing } from '#cli/repository/files/tracked.ts';
import {
    mergeAttributes,
    parseAttributePatterns,
    parseListingLine,
    parsePathAttributes,
} from '#cli/repository/git/output.ts';
import { isOutsideRepository, runGit } from '#cli/repository/git/run.ts';
import { detectScopeFolders } from '#cli/repository/scopes.ts';
import { gitIndexFileSchema } from '#cli/schemas/repository.ts';
import { GspotError } from '#cli/system/errors.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { findText, readBytes, readText } from '#cli/system/files/reads.ts';
import { compareText } from '#cli/system/text.ts';
import type {
    GeneratedPaths,
    Repository,
    RepositoryListing,
    ScopeFolder,
    TrackedFile,
    UntrackedFiles,
} from '#cli/types/repository.ts';
import type { RunCache } from '#cli/types/system.ts';

type RepositoryReadOptions = {
    generatedPaths: GeneratedPaths[];
    scopes: Array<Pick<ScopeFolder, 'path' | 'configurations'>>;
};

async function readAttributes(root: string, paths: string[]): Promise<Map<string, Record<string, string>>> {
    if (paths.length === 0) return new Map();
    const result = await runGit(root, GIT_CHECK_ATTRIBUTES_ARGUMENTS, {
        stdin: paths.join('\0') + '\0',
    });
    if (result.code !== 0) throw new GspotError('git', `Git could not read the attributes: ${result.stderr.trim()}`);
    return parsePathAttributes(result.stdout);
}

export async function listRepositoryFiles(cache: RunCache, untracked?: UntrackedFiles): Promise<RepositoryListing> {
    const root = cache.root;
    const unreadablePaths = [...(untracked?.unreadablePaths ?? [])];
    const indexed = await readGitListing(root, GIT_INDEX_FILES_ARGUMENTS, undefined, unreadablePaths);
    const untrackedListing =
        untracked === undefined
            ? await readGitListing(root, GIT_UNTRACKED_FILES_ARGUMENTS, undefined, unreadablePaths)
            : untracked.paths.join('\0');
    const index = indexed
        .split('\0')
        .filter(Boolean)
        .map((line) => parseListingLine(INDEX_LINE.exec(line), gitIndexFileSchema));
    const listedFiles = listTrackedFiles(root, index, untrackedListing);
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

export async function readRepository(
    cache: RunCache,
    listing: RepositoryListing,
    { generatedPaths, scopes }: RepositoryReadOptions,
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
    const discovered = detectScopeFolders(tracked, dependencyFiles, readConfigurations().values());
    const written: ScopeFolder[] = [
        { ...ROOT_SCOPE, configurations: [] },
        ...scopes
            .filter((each) => files.findStats(each.path)?.isDirectory() === true)
            .map((each): ScopeFolder => ({
                path: each.path,
                configurations: each.configurations,
                origin: SETTINGS_FILE,
            })),
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

export async function readRepositoryRoot(start: string): Promise<string> {
    const folder = realpathSync(start);
    const top = await runGit(folder, GIT_TOP_LEVEL_ARGUMENTS, { env: GIT_LOCALE });
    if (top.code === 0) return resolve(top.stdout.replace(TRAILING_NEWLINE, ''));
    if (isOutsideRepository(top)) throw new GspotError('git', NEEDS_GIT_MESSAGE);
    if (top.stderr.includes('must be run in a work tree'))
        throw new GspotError(
            'git',
            'This folder is a bare repository or a Git folder, not a work tree. Run gspot in the work tree.',
        );
    throw new GspotError('git', `Git could not open this folder: ${top.stderr.trim()}`);
}
