// Classifies repository files from attributes and content.
// Reads the repository inventory, classifies source files, and records written scopes.

import { posix } from 'node:path';
import { tagEntry } from '#cli/repository/tags.ts';
import { readSource } from '#cli/system/files/reads.ts';
import { extractExtension } from '#cli/system/paths.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import { findBlockSpan } from '#cli/system/managed-blocks.ts';
import { MARKERS } from '#cli/config/system/managed-blocks.ts';
import { hasGeneratedHeader } from '#cli/parsers/generated-header.ts';
import { GITATTRIBUTES_FILE } from '#cli/config/repository/tracked.ts';
import { DOT_GSPOT, VALE_PACKAGE_DIRECTORY } from '#cli/config/system/locations.ts';

import type {
    FileEntry,
    TrackedFile,
    FileClassification,
    FileClassificationRules,
} from '#cli/types/repository/inventory.ts';
import {
    SET_VALUES,
    LFS_FILTER,
    NOTICE_FILE,
    SOURCE_KIND,
    BANNER_BYTES,
    LICENSE_FILE,
    LICENSE_TAGS,
    ATTRIBUTE_SET,
    TEXT_ATTRIBUTE,
    EXTENSION_TAGS,
    FILTER_ATTRIBUTE,
    VENDORED_FOLDERS,
    GENERATED_BANNERS,
    VENDORED_ATTRIBUTE,
    MARKDOWN_EXTENSION,
    GENERATED_ATTRIBUTE,
    GENERATED_BUILD_WRAPPERS,
} from '#cli/config/repository/inventory.ts';

// Every tracked path has one kind: source, generated, vendored, binary.

function declaredKind(path: string, rules: FileClassificationRules): FileClassification | undefined {
    const attribute = attributeKind(rules.attributes.get(path));
    if (attribute !== undefined) return attribute;
    const declaration = rules.declarations.find((entry) => pathMatcher(entry.paths)(path));
    return declaration === undefined ? undefined : { kind: declaration.kind, source: declaration.configuration };
}

function attributeKind(attributes: Record<string, string> | undefined): FileClassification | undefined {
    if (attributes === undefined) return undefined;
    if (new Set<string | undefined>(SET_VALUES).has(attributes[GENERATED_ATTRIBUTE]))
        return { kind: 'generated', source: GITATTRIBUTES_FILE };
    if (new Set<string | undefined>(SET_VALUES).has(attributes[VENDORED_ATTRIBUTE]))
        return { kind: 'vendored', source: GITATTRIBUTES_FILE };
    const isBinary = attributes[TEXT_ATTRIBUTE] === 'unset' || attributes[FILTER_ATTRIBUTE] === LFS_FILTER;
    return isBinary ? { kind: 'binary', source: GITATTRIBUTES_FILE } : undefined;
}

// License texts belong to another party. A code file whose name looks like a license stays source.
function isLicenseFile(path: string): boolean {
    const name = posix.basename(path);
    const tags = (EXTENSION_TAGS as Readonly<Record<string, readonly string[]>>)[extractExtension(name)] ?? [];
    return (LICENSE_FILE.test(name) || NOTICE_FILE.test(name)) && tags.every((tag) => LICENSE_TAGS.has(tag));
}

// Tool paths and banners identify generated files; downloaded Vale styles belong to another party.
function fileOrigin(path: string, prefix: Buffer): FileClassification | undefined {
    if (isValePackageFile(path)) return { kind: 'vendored', source: 'gspot' };
    if (path.startsWith(`${DOT_GSPOT}/`)) return { kind: 'generated', source: 'gspot' };
    if (GENERATED_BUILD_WRAPPERS.has(posix.basename(path))) return { kind: 'generated', source: 'build wrapper' };
    const start = prefix.subarray(0, BANNER_BYTES).toString('utf8');
    if (hasGeneratedHeader(start) || GENERATED_BANNERS.some((banner) => banner.test(start)))
        return { kind: 'generated', source: 'banner' };
    return undefined;
}

// Higher-priority kinds take precedence; only a wholly managed instruction document makes remaining content generated.
function sourceKind(root: string, entry: FileEntry, prefix: Buffer): FileClassification {
    if (entry.symlink || !entry.path.endsWith(MARKDOWN_EXTENSION) || !prefix.includes(MARKERS.markdown.start))
        return SOURCE_KIND;
    const text = readSource(root, entry.path).toString('utf8');
    const span = findBlockSpan(text, { path: entry.path, style: 'markdown' });
    if (span === undefined || `${text.slice(0, span.start)}${text.slice(span.end)}`.trim() !== '') return SOURCE_KIND;
    return { kind: 'generated', source: 'gspot' };
}

/**
 * Whether a path identifies a Vale package file: under the styles folder and not the gspot style or accepted-word files.
 * @param path the file, relative to the root.
 * @returns true for a package file.
 */
function isValePackageFile(path: string): boolean {
    return path.startsWith(`${VALE_PACKAGE_DIRECTORY}/`);
}

/**
 * Classify from declarations, attributes, binary content, managed paths, banners, then vendored directories.
 * @param file the source entry, its captured bytes, and repository location.
 * @param file.root the repository directory.
 * @param file.entry the tracked file entry.
 * @param file.prefix the initial file bytes.
 * @param file.isBinary whether the initial bytes contain binary data.
 * @param rules the generated and vendored declarations and captured Git attributes.
 * @returns the kind and where it came from.
 */
function kindOf(
    file: { root: string; entry: FileEntry; prefix: Buffer; isBinary: boolean },
    rules: FileClassificationRules,
): FileClassification {
    const { root, entry, isBinary, prefix } = file;
    const { path } = entry;
    const declared = declaredKind(path, rules);
    if (declared) return declared;
    // Explicit text attributes override binary content and extension hints.
    if (isBinary && rules.attributes.get(path)?.[TEXT_ATTRIBUTE] !== ATTRIBUTE_SET)
        return { kind: 'binary', source: 'content' };
    if (isLicenseFile(path)) return { kind: 'vendored', source: 'license' };
    const managed = fileOrigin(path, prefix);
    if (managed) return managed;
    if (
        path
            .split('/')
            .slice(0, -1)
            .some((segment) => new Set<string | undefined>(VENDORED_FOLDERS).has(segment))
    )
        return { kind: 'vendored', source: 'directory' };
    return sourceKind(root, entry, prefix);
}

/**
 * Determine a tracked file's kind and the source of that classification.
 * @param root the repository directory.
 * @param entry the tracked file entry.
 * @param prefix the initial file bytes.
 * @param rules the file declarations used for classification.
 * @returns the file kind and its classification source.
 */
export function classifyFile(
    root: string,
    entry: FileEntry,
    prefix: Buffer,
    rules: FileClassificationRules,
): TrackedFile {
    const tagged = tagEntry(entry, prefix);
    const verdict = kindOf({ root, entry, prefix, isBinary: tagged.binary }, rules);
    const file: TrackedFile = {
        path: entry.path,
        kind: verdict.kind,
        kindSource: verdict.source,
        tags: tagged.tags,
        executable: entry.executable,
        size: entry.size,
    };
    return file;
}
