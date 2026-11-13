import { posix } from 'node:path';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { GITATTRIBUTES_FILE, MARKERS } from '#cli/config/parsers/formats.ts';
import {
    BANNER_BYTES,
    BUILD_LAUNCHERS,
    DIFF_ATTRIBUTE,
    EXTENSION_TAGS,
    FILTER_ATTRIBUTE,
    GENERATED_ATTRIBUTE,
    GENERATOR_OUTPUT_BANNERS,
    KIND_ORIGINS,
    LFS_FILTER,
    LICENSE_FILE,
    LICENSE_TAGS,
    MARKDOWN_EXTENSION,
    NOTICE_FILE,
    SET_STATE,
    SET_VALUES,
    SOURCE_KIND,
    TEXT_ATTRIBUTE,
    UNSET_STATE,
    VENDORED_ATTRIBUTE,
    VENDORED_FOLDERS,
} from '#cli/config/repository/files.ts';
import { stripBlock } from '#cli/parsers/formats/managed-blocks.ts';
import { hasGeneratedHeader, isGspotPath } from '#cli/repository/files/ownership.ts';
import { tagFile } from '#cli/repository/files/tags.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import { readText } from '#cli/system/files/reads.ts';
import { extractExtension } from '#cli/system/paths.ts';
import { buildPathMatcher } from '#cli/system/patterns.ts';
import type { Config, Configuration } from '#cli/types/manifests.ts';
import type {
    FileClassification,
    FileKindRules,
    GeneratedPaths,
    ListedFile,
    RepositoryListing,
    TrackedFile,
} from '#cli/types/repository.ts';

function findConfiguredKind(path: string, rules: FileKindRules): FileClassification | undefined {
    const attribute = findAttributeKind(rules.attributes.get(path));
    if (attribute !== undefined) return attribute;
    const generated = rules.generatedPaths.find((rule) => isInScope(path, rule.scopePath) && rule.isMatch(path));
    return generated === undefined ? undefined : { kind: generated.kind, origin: generated.configuration };
}

function findAttributeKind(attributes: Record<string, string> | undefined): FileClassification | undefined {
    if (attributes === undefined) return undefined;
    const generated = attributes[GENERATED_ATTRIBUTE];
    if (generated !== undefined && SET_VALUES.has(generated)) return { kind: 'generated', origin: GITATTRIBUTES_FILE };
    const vendored = attributes[VENDORED_ATTRIBUTE];
    if (vendored !== undefined && SET_VALUES.has(vendored)) return { kind: 'vendored', origin: GITATTRIBUTES_FILE };
    const isBinary = attributes[DIFF_ATTRIBUTE] === UNSET_STATE || attributes[FILTER_ATTRIBUTE] === LFS_FILTER;
    return isBinary ? { kind: 'binary', origin: GITATTRIBUTES_FILE } : undefined;
}

function isLicenseFile(path: string): boolean {
    const name = posix.basename(path);
    const tags = EXTENSION_TAGS[extractExtension(name)] ?? [];
    return (LICENSE_FILE.test(name) || NOTICE_FILE.test(name)) && tags.every((tag) => LICENSE_TAGS.has(tag));
}

function findGeneratedKind(path: string, prefix: Buffer): FileClassification | undefined {
    if (path.startsWith(`${GSPOT_PATHS.valePackages}/`)) return { kind: 'vendored', origin: KIND_ORIGINS.gspot };
    if (isGspotPath(path)) return { kind: 'generated', origin: KIND_ORIGINS.gspot };
    if (BUILD_LAUNCHERS.has(posix.basename(path))) return { kind: 'generated', origin: KIND_ORIGINS.buildLauncher };
    const start = prefix.subarray(0, BANNER_BYTES).toString('utf8');
    return hasGeneratedHeader(start) || GENERATOR_OUTPUT_BANNERS.some(({ pattern }) => pattern.test(start))
        ? { kind: 'generated', origin: KIND_ORIGINS.banner }
        : undefined;
}

function classifyManagedDocument(root: string, file: ListedFile, prefix: Buffer): FileClassification {
    if (file.isSymlink || !file.path.endsWith(MARKDOWN_EXTENSION) || !prefix.includes(MARKERS.markdown.start))
        return SOURCE_KIND;
    const text = readText(root, file.path);
    const authored = stripBlock(text, file.path);
    return authored === text || authored.trim() !== ''
        ? SOURCE_KIND
        : { kind: 'generated', origin: KIND_ORIGINS.gspot };
}

function classifyKind(
    file: { root: string; listed: ListedFile; prefix: Buffer; isBinary: boolean },
    rules: FileKindRules,
): FileClassification {
    const { root, listed, isBinary, prefix } = file;
    const { path } = listed;
    const configured = findConfiguredKind(path, rules);
    if (configured) return configured;
    if (isBinary && rules.attributes.get(path)?.[TEXT_ATTRIBUTE] !== SET_STATE)
        return { kind: 'binary', origin: KIND_ORIGINS.content };
    if (isLicenseFile(path)) return { kind: 'vendored', origin: KIND_ORIGINS.license };
    const managed = findGeneratedKind(path, prefix);
    if (managed) return managed;
    if (
        path
            .split('/')
            .slice(0, -1)
            .some((segment) => VENDORED_FOLDERS.has(segment))
    )
        return { kind: 'vendored', origin: KIND_ORIGINS.vendoredFolder };
    return classifyManagedDocument(root, listed, prefix);
}

function listPointerFiles(path: string, files: Config[]): string[] {
    return files.flatMap((file) => {
        const pointer = file.pointer;
        if (pointer === undefined) return [];
        const scopePath = file.per_scope ? path : '';
        return (pointer.folders ?? ['']).map((folder) => posix.join(scopePath, folder, pointer.path));
    });
}

export function classifyFile(
    root: string,
    file: RepositoryListing['files'][number],
    rules: FileKindRules,
): TrackedFile {
    const tagged = tagFile(file, file.prefix);
    const kind = classifyKind({ root, listed: file, prefix: file.prefix, isBinary: tagged.isBinary }, rules);
    return {
        path: file.path,
        kind: kind.kind,
        kindOrigin: kind.origin,
        tags: tagged.tags,
        executable: file.executable,
        size: file.size,
    };
}

export function listConfigurationGeneratedPaths(selected: Map<string, Configuration[]>): GeneratedPaths[] {
    return selected
        .entries()
        .flatMap(([scopePath, configurations]) =>
            configurations.flatMap(({ generated, name, configs }) => {
                const paths = [
                    ...generated.map((file) => posix.join(scopePath, file)),
                    ...listPointerFiles(scopePath, configs),
                ];
                return paths.length === 0
                    ? []
                    : {
                          kind: 'generated' as const,
                          configuration: name,
                          scopePath: paths.every((path) => isInScope(path, scopePath)) ? scopePath : '',
                          isMatch: buildPathMatcher(paths),
                      };
            }),
        )
        .toArray();
}

export function listGeneratedPaths(files: TrackedFile[]): ReadonlySet<string> {
    return new Set(files.filter(({ kind }) => kind === 'generated').map(({ path }) => path));
}
