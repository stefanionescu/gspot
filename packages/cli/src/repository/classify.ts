// Classifies repository files, tags, and generated declarations.
import { posix } from 'node:path';
import { readBytes } from '#cli/system/files/reads.ts';
import { extractExtension } from '#cli/system/paths.ts';
import { pathMatcher } from '#cli/repository/matchers.ts';
import { LOCKFILES } from '#cli/config/parsers/lockfiles.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { findBlockSpan } from '#cli/system/managed-blocks.ts';
import { MARKERS } from '#cli/config/system/managed-blocks.ts';
import type { Lockfile } from '#cli/types/parsers/lockfiles.ts';
import { JAVASCRIPT_RUNTIMES } from '#cli/config/parsers/dependency-files.ts';
import { DOT_GSPOT, VALE_PACKAGE_DIRECTORY } from '#cli/config/system/locations.ts';
import { HEADER_LINES_CHECKED, GENERATED_HEADER_LINE } from '#cli/config/generation/header.ts';
import { GITATTRIBUTES_FILE, INSTALLED_DEPENDENCY_FOLDERS } from '#cli/config/repository/tracked.ts';
import { ENV_SPLIT_FLAG, SHEBANG_PREFIX, ENV_EXECUTABLE_SUFFIX } from '#cli/config/parsers/shebang.ts';

import {
    type Tagged,
    type FileEntry,
    type TrackedFile,
    type ContentPrefix,
    type FileDeclaration,
    type FileClassification,
    type FileClassificationRules,
} from '#cli/types/repository/inventory.ts';
import {
    TEXT_TAG,
    SET_VALUES,
    LFS_FILTER,
    BINARY_TAG,
    NOTICE_FILE,
    SOURCE_KIND,
    RUNTIME_TAG,
    SHEBANG_TAG,
    BANNER_BYTES,
    LICENSE_FILE,
    LICENSE_TAGS,
    SHEBANG_TAGS,
    ATTRIBUTE_SET,
    DOTENV_PREFIX,
    FILENAME_TAGS,
    TEXT_ATTRIBUTE,
    EXTENSION_TAGS,
    DEFAULT_DIALECT,
    DOCKERFILE_NAME,
    FILTER_ATTRIBUTE,
    VENDORED_FOLDERS,
    GENERATED_BANNERS,
    BINARY_EXTENSIONS,
    VENDORED_ATTRIBUTE,
    MARKDOWN_EXTENSION,
    VERSION_CHARACTERS,
    GENERATED_ATTRIBUTE,
    DOCKERFILE_EXTENSION,
    INTERPRETER_DIALECTS,
    SHEBANG_INTERPRETERS,
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
    const text = readBytes(root, entry.path).toString('utf8');
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

function sniff(buffer: Buffer): ContentPrefix {
    if (buffer.includes(0)) return { isBinary: true, firstLine: '' };
    const text = buffer.toString('utf8');
    const newline = text.indexOf('\n');
    return { isBinary: false, firstLine: newline === -1 ? text : text.slice(0, newline) };
}

function shebangTags(firstLine: string): string[] {
    const interpreter = parseShebang(firstLine);
    if (interpreter === undefined) return [];
    const shebang =
        (SHEBANG_INTERPRETERS as Readonly<Record<string, string>>)[interpreter] ??
        (SHEBANG_INTERPRETERS as Readonly<Record<string, string>>)[withoutTrailingVersion(interpreter)];
    if (shebang === undefined) return [];
    const dialect = (INTERPRETER_DIALECTS as Readonly<Record<string, string>>)[interpreter] ?? DEFAULT_DIALECT;
    const runtime = JAVASCRIPT_RUNTIMES.find((name) => name === interpreter);
    return [
        ...((SHEBANG_TAGS as Readonly<Record<string, readonly string[]>>)[shebang] ?? []),
        `${SHEBANG_TAG}${shebang}`,
        ...(shebang === 'shell' ? [dialect] : []),
        ...(runtime === undefined ? [] : [`${RUNTIME_TAG}${runtime}`]),
    ];
}

function textTags(tags: Set<string>, firstLine: string): Tagged {
    for (const tag of shebangTags(firstLine)) tags.add(tag);
    if (Object.values(INTERPRETER_DIALECTS).some((dialect) => tags.has(dialect))) tags.delete('bash');
    tags.add(TEXT_TAG);
    return { tags: [...tags], binary: false };
}

function withoutTrailingVersion(word: string): string {
    let end = word.length;
    while (end > 0 && VERSION_CHARACTERS.includes(word[end - 1] ?? '')) end -= 1;
    return word.slice(0, end);
}

/**
 * Detect the generated gspot marker in the opening comment lines.
 * @param text a file's opening text.
 * @returns whether the text carries the generated marker.
 */
function hasGeneratedHeader(text: string): boolean {
    const lines = text.split('\n', HEADER_LINES_CHECKED);
    return lines.some((line) => GENERATED_HEADER_LINE.test(line));
}

/**
 * Read the first executable, skipping env and its -S argument when present.
 * @param firstLine the first source line.
 * @returns the executable basename, or undefined without an executable shebang.
 */
function parseShebang(firstLine: string): string | undefined {
    if (!firstLine.startsWith(SHEBANG_PREFIX)) return undefined;
    const tokens = firstLine.slice(SHEBANG_PREFIX.length).trim().split(/\s+/u);
    let index = 0;
    if (tokens[index]?.endsWith(ENV_EXECUTABLE_SUFFIX) === true) index += 1;
    if (tokens[index] === ENV_SPLIT_FLAG) index += 1;
    const word = tokens[index];
    return word === undefined || word === '' ? undefined : posix.basename(word);
}

/**
 * Read the declared consumers of one repository lockfile.
 * @param path the repository-relative file.
 * @returns its metadata, or undefined for an unsupported filename.
 */
function findLockfile(path: string): Lockfile | undefined {
    return LOCKFILES.find((entry) => entry.file === posix.basename(path));
}

/**
 * Determine a tracked file's kind and the source of that classification.
 * @param root the repository directory.
 * @param entry the tracked file entry.
 * @param prefix the initial file bytes.
 * @param rules the file declarations used for classification.
 * @returns the file kind and its classification source.
 */
function classifyFile(root: string, entry: FileEntry, prefix: Buffer, rules: FileClassificationRules): TrackedFile {
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

/**
 * Tags for one entry. Binary files retain path tags and do not receive content tags.
 * @param entry the tracked entry.
 * @param prefix the captured first bytes.
 * @returns the path and content tags, and whether the file contains binary bytes.
 */
function tagEntry(entry: FileEntry, prefix: Buffer): Tagged {
    const extension = extractExtension(entry.path);
    const base = posix.basename(entry.path);
    const flags: [boolean, string][] = [
        [entry.symlink, 'symlink'],
        [findLockfile(base) !== undefined, 'lockfile'],
        [base.startsWith(DOCKERFILE_NAME) || extension === DOCKERFILE_EXTENSION, 'dockerfile'],
        [base.startsWith(DOTENV_PREFIX), 'dotenv'],
        [entry.executable, 'executable'],
    ];
    const tags = new Set<string>([
        ...((EXTENSION_TAGS as Readonly<Record<string, readonly string[]>>)[extension] ?? []),
        ...((FILENAME_TAGS as Readonly<Record<string, readonly string[]>>)[base] ?? []),
        ...flags.filter(([isSet]) => isSet).map(([, tag]) => tag),
    ]);
    if (new Set<string | undefined>(BINARY_EXTENSIONS).has(extension))
        return { tags: [BINARY_TAG, ...tags], binary: true };
    const sniffed = sniff(prefix);
    if (sniffed.isBinary) return { tags: [BINARY_TAG, ...tags], binary: true };
    return textTags(tags, sniffed.firstLine);
}

/**
 * Extensions whose authoritative inventory tags include any requested language or content tag.
 * @param tags the language or content tags to select.
 * @returns extensions in inventory order.
 */
function extensionsTagged(...tags: string[]): string[] {
    return Object.entries(EXTENSION_TAGS)
        .filter(([, owned]) => tags.some((tag) => new Set<string>(owned).has(tag)))
        .map(([extension]) => extension);
}

/**
 * Resolve generated paths of the configurations each scope selects.
 * @param selected the actual manifests selected by each written scope.
 * @returns file declarations with internal configuration origins retained.
 */
function fileDeclarations(selected: Map<string, Manifest[]>): FileDeclaration[] {
    return selected
        .entries()
        .flatMap(([path, manifests]) =>
            manifests.flatMap(({ generated, configuration }) =>
                generated.length === 0
                    ? []
                    : [
                          {
                              kind: 'generated' as const,
                              configuration: configuration.name,
                              paths: generated.map((file) => posix.join(path, file)),
                          },
                      ],
            ),
        )
        .toArray();
}

/**
 * Whether a repository path belongs to a gspot tool project.
 * @param path the repository-relative path.
 * @returns whether a .gspot folder contains the file.
 */
function isInGspotFolder(path: string): boolean {
    return path.split('/').some((part) => part.toLowerCase() === DOT_GSPOT);
}

/**
 * Whether a repository path belongs to tool projects or installed npm dependencies.
 * @param path the repository-relative path.
 * @returns whether project discovery must leave out the path.
 */
function isToolingPath(path: string): boolean {
    return isInGspotFolder(path) || path.split('/').some((part) => INSTALLED_DEPENDENCY_FOLDERS.has(part));
}

export {
    findLockfile,
    classifyFile,
    isToolingPath,
    isInGspotFolder,
    extensionsTagged,
    fileDeclarations,
    hasGeneratedHeader,
};
