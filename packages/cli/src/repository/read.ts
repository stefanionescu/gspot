// Reads repository files, scopes, and dependency declarations.
import { posix } from 'node:path';
import { runGitBlocking } from '#cli/system/git.ts';
import { classifyFile } from '#cli/repository/kind.ts';
import { buildScope } from '#cli/repository/scopes.ts';
import { swiftSourceTags } from '#cli/parsers/swift.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { ROOT_SCOPE } from '#cli/config/repository/scopes.ts';
import { SWIFT_EXTENSION } from '#cli/config/parsers/swift.ts';
import { isGitRepository } from '#cli/repository/find-root.ts';
import { SETTINGS_FILE } from '#cli/config/system/locations.ts';
import { openSafeFolder } from '#cli/system/safe-folder/open.ts';
import { GITATTRIBUTES_FILE } from '#cli/config/repository/tracked.ts';
import { attributesFor, gitAttributes, attributeRules } from '#cli/parsers/git.ts';
import { readIndexEntries, listRepositoryFiles } from '#cli/repository/tracked.ts';
import { readText, readPrefix, readSource, createReadCache } from '#cli/system/file-reads.ts';
import type { Repository, ScopeEntry, TrackedFile, FileDeclaration } from '#cli/types/repository/inventory.ts';

import {
    SET_VALUES,
    FILE_PREFIX_BYTES,
    VENDORED_ATTRIBUTE,
    GENERATED_ATTRIBUTE,
    CHECK_ATTRIBUTES_ARGV,
} from '#cli/config/repository/inventory.ts';

/**
 * Reads attribute rules once for a repository read.
 * @param root the repository root.
 * @param paths the tracked attribute-file paths.
 * @param hasGit whether Git can evaluate repository and user attribute precedence.
 * @returns the parsed rules, or none when the optional file does not exist.
 */
function readAttributes(root: string, paths: string[], hasGit: boolean): Map<string, Record<string, string>> {
    if (paths.length === 0) return new Map();
    if (hasGit) {
        const result = runGitBlocking(root, [...CHECK_ATTRIBUTES_ARGV], {
            stdin: paths.join('\0') + '\0',
        });
        if (result.code !== 0) throw new Error(`Git could not read the attributes: ${result.stderr.trim()}`);
        return gitAttributes(result.stdout);
    }
    const files = [
        ...new Set([GITATTRIBUTES_FILE, ...paths.filter((path) => posix.basename(path) === GITATTRIBUTES_FILE)]),
    ];
    const declarations = files
        .toSorted((left, right) => left.split('/').length - right.split('/').length)
        .flatMap((path) => {
            const text = readText(root, path);
            return text === undefined ? [] : attributeRules(text, posix.dirname(path));
        });
    const rules = declarations.map((entry) => ({
        matcher: pathMatcher([entry.pattern]),
        attributes: entry.attributes,
    }));
    const attributes = new Map<string, Record<string, string>>();
    for (const path of paths) {
        let effective: Record<string, string> = {};
        for (const rule of rules.filter((entry) => entry.matcher(path)))
            effective = attributesFor(rule.attributes, effective);
        attributes.set(path, effective);
    }
    return attributes;
}

/**
 * Reads the tracked file inventory with source kinds, language tags, and written scopes.
 * @param rootPath the repository root.
 * @param declarations the generated and vendored declarations.
 * @param scopeEntries the [[scope]] entries.
 * @param reads the repository root and cached source reads.
 * @returns the repository record.
 */
export async function readRepository(
    rootPath: string,
    declarations: FileDeclaration[],
    scopeEntries: Pick<ScopeEntry, 'path' | 'configurations'>[],
    reads: ReadCache = createReadCache(rootPath),
): Promise<Repository> {
    const root = reads.root;
    const hasGit = isGitRepository(root);
    const index = hasGit ? await readIndexEntries(root) : [];
    const entries = await listRepositoryFiles(root, index, hasGit);
    using directory = openSafeFolder(root);
    const files: TrackedFile[] = [];
    const attributes = readAttributes(
        root,
        entries.map((entry) => entry.path),
        hasGit,
    );
    for (const entry of entries) {
        const prefix = entry.symlink ? Buffer.alloc(0) : readPrefix(root, entry.path, FILE_PREFIX_BYTES, reads);
        const file = classifyFile(root, entry, prefix, { declarations, attributes });
        if (!entry.symlink && file.kind === 'source' && file.path.endsWith(SWIFT_EXTENSION)) {
            const tags = await swiftSourceTags(file.path, readSource(root, file.path, reads).toString('utf8'));
            file.tags.push(...tags);
        }
        files.push(file);
    }
    return {
        root,
        attributes,
        index,
        hasGit,
        files,
        scopes: [
            { ...ROOT_SCOPE, configurations: [] },
            ...scopeEntries
                .filter((entry) => directory.stat(entry.path)?.isDirectory() === true)
                .map((entry) =>
                    buildScope({
                        path: entry.path,
                        configurations: entry.configurations,
                        source: SETTINGS_FILE,
                    }),
                ),
        ],
    };
}

/**
 * Read generated and vendored selectors from each tracked attribute file.
 * @param root the repository folder.
 * @param paths tracked root-relative paths.
 * @param reads the run's source reads.
 * @returns the selectors declared by Git attributes.
 */
export function readGeneratedPatterns(root: string, paths: string[], reads?: ReadCache): string[] {
    return [
        ...new Set(
            paths
                .filter((path) => posix.basename(path) === GITATTRIBUTES_FILE)
                .flatMap((path) =>
                    attributeRules(readSource(root, path, reads).toString('utf8'), posix.dirname(path))
                        .filter((rule) =>
                            Object.entries(attributesFor(rule.attributes, {})).some(
                                ([name, value]) =>
                                    (name === GENERATED_ATTRIBUTE || name === VENDORED_ATTRIBUTE) &&
                                    new Set<string | undefined>(SET_VALUES).has(value),
                            ),
                        )
                        .map((rule) => rule.pattern),
                ),
        ),
    ];
}
