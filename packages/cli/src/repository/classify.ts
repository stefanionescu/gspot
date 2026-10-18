// Classifies repository files, tags, and generated declarations.
import { posix } from 'node:path';
import { readBytes } from '#cli/system/files/reads.ts';
import { extractExtension } from '#cli/system/paths.ts';
import { LOCKFILES } from '#cli/config/parsers/lockfiles.ts';
import { findBlockSpan } from '#cli/system/managed-blocks.ts';
import { MARKERS } from '#cli/config/system/managed-blocks.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import type { Lockfile } from '#cli/types/parsers/lockfiles.ts';
import { JAVASCRIPT_RUNTIMES } from '#cli/config/parsers/dependency-files.ts';
import { DOT_GSPOT, VALE_PACKAGES_PATH } from '#cli/config/system/locations.ts';
import type { Manifest, ToolFileDeclaration } from '#cli/types/configurations.ts';
import { HEADER_LINES_CHECKED, GENERATED_HEADER_LINE } from '#cli/config/generation/header.ts';
import { GITATTRIBUTES_FILE, INSTALLED_DEPENDENCY_FOLDERS } from '#cli/config/repository/tracked.ts';
import { ENV_SPLIT_FLAG, SHEBANG_PREFIX, ENV_EXECUTABLE_SUFFIX } from '#cli/config/parsers/shebang.ts';

import {
    type Tagged,
    type ListedFile,
    type TrackedFile,
    type FileDeclaration,
    type FileClassification,
    type ClassificationInputs,
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
    BUILD_LAUNCHERS,
    FILTER_ATTRIBUTE,
    VENDORED_FOLDERS,
    BINARY_EXTENSIONS,
    VENDORED_ATTRIBUTE,
    MARKDOWN_EXTENSION,
    VERSION_CHARACTERS,
    GENERATED_ATTRIBUTE,
    DOCKERFILE_EXTENSION,
    INTERPRETER_DIALECTS,
    SHEBANG_INTERPRETERS,
    GENERATOR_OUTPUT_BANNERS,
} from '#cli/config/repository/inventory.ts';

// Every tracked path has one kind: source, generated, vendored, binary.

function findDeclaredKind(path: string, inputs: ClassificationInputs): FileClassification | undefined {
    const attribute = findAttributeKind(inputs.attributes.get(path));
    if (attribute !== undefined) return attribute;
    const declaration = inputs.declarations.find((entry) => buildPathMatcher(entry.paths)(path));
    return declaration === undefined ? undefined : { kind: declaration.kind, origin: declaration.configuration };
}

function findAttributeKind(attributes: Record<string, string> | undefined): FileClassification | undefined {
    if (attributes === undefined) return undefined;
    const generated = attributes[GENERATED_ATTRIBUTE];
    if (generated !== undefined && SET_VALUES.has(generated)) return { kind: 'generated', origin: GITATTRIBUTES_FILE };
    const vendored = attributes[VENDORED_ATTRIBUTE];
    if (vendored !== undefined && SET_VALUES.has(vendored)) return { kind: 'vendored', origin: GITATTRIBUTES_FILE };
    const isBinary = attributes[TEXT_ATTRIBUTE] === 'unset' || attributes[FILTER_ATTRIBUTE] === LFS_FILTER;
    return isBinary ? { kind: 'binary', origin: GITATTRIBUTES_FILE } : undefined;
}

// License texts belong to another party. A code file whose name looks like a license stays source.
function isLicenseFile(path: string): boolean {
    const name = posix.basename(path);
    const tags = EXTENSION_TAGS[extractExtension(name)] ?? [];
    return (LICENSE_FILE.test(name) || NOTICE_FILE.test(name)) && tags.every((tag) => LICENSE_TAGS.has(tag));
}

// Tool paths and banners identify generated files; downloaded Vale styles belong to another party.
function findGeneratedKind(path: string, prefix: Buffer): FileClassification | undefined {
    if (path.startsWith(`${VALE_PACKAGES_PATH}/`)) return { kind: 'vendored', origin: 'gspot' };
    if (isInGspotFolder(path)) return { kind: 'generated', origin: 'gspot' };
    if (BUILD_LAUNCHERS.has(posix.basename(path))) return { kind: 'generated', origin: 'build wrapper' };
    const start = prefix.subarray(0, BANNER_BYTES).toString('utf8');
    if (hasGeneratedHeader(start) || GENERATOR_OUTPUT_BANNERS.some((banner) => banner.test(start)))
        return { kind: 'generated', origin: 'banner' };
    return undefined;
}

// Higher-priority kinds take precedence; only a wholly managed instruction document makes remaining content generated.
function classifyManagedDocument(root: string, entry: ListedFile, prefix: Buffer): FileClassification {
    if (entry.symlink || !entry.path.endsWith(MARKDOWN_EXTENSION) || !prefix.includes(MARKERS.markdown.start))
        return SOURCE_KIND;
    const text = readBytes(root, entry.path).toString('utf8');
    const span = findBlockSpan(text, { path: entry.path, style: 'markdown' });
    if (span === undefined || `${text.slice(0, span.start)}${text.slice(span.end)}`.trim() !== '') return SOURCE_KIND;
    return { kind: 'generated', origin: 'gspot' };
}

/**
 * Classify from declarations, attributes, binary content, managed paths, banners, then vendored folders.
 * @param file what to classify.
 * @param file.root the repository folder.
 * @param file.entry the tracked listing item.
 * @param file.prefix the first bytes of the file.
 * @param file.isBinary whether those bytes hold binary data.
 * @param inputs the generated and vendored declarations and captured Git attributes.
 * @returns the kind and where it came from.
 */
function classifyKind(
    file: { root: string; entry: ListedFile; prefix: Buffer; isBinary: boolean },
    inputs: ClassificationInputs,
): FileClassification {
    const { root, entry, isBinary, prefix } = file;
    const { path } = entry;
    const declared = findDeclaredKind(path, inputs);
    if (declared) return declared;
    // Explicit text attributes override binary content and extension hints.
    if (isBinary && inputs.attributes.get(path)?.[TEXT_ATTRIBUTE] !== ATTRIBUTE_SET)
        return { kind: 'binary', origin: 'content' };
    if (isLicenseFile(path)) return { kind: 'vendored', origin: 'license' };
    const managed = findGeneratedKind(path, prefix);
    if (managed) return managed;
    if (
        path
            .split('/')
            .slice(0, -1)
            .some((segment) => VENDORED_FOLDERS.has(segment))
    )
        return { kind: 'vendored', origin: 'directory' };
    return classifyManagedDocument(root, entry, prefix);
}

function listShebangTags(firstLine: string): string[] {
    const interpreter = parseShebang(firstLine);
    if (interpreter === undefined) return [];
    const shebang = SHEBANG_INTERPRETERS[interpreter] ?? SHEBANG_INTERPRETERS[stripTrailingVersion(interpreter)];
    if (shebang === undefined) return [];
    const dialect = INTERPRETER_DIALECTS[interpreter] ?? DEFAULT_DIALECT;
    const runtime = JAVASCRIPT_RUNTIMES.find((name) => name === interpreter);
    return [
        ...(SHEBANG_TAGS[shebang] ?? []),
        `${SHEBANG_TAG}${shebang}`,
        ...(shebang === 'shell' ? [dialect] : []),
        ...(runtime === undefined ? [] : [`${RUNTIME_TAG}${runtime}`]),
    ];
}

function tagTextFile(tags: Set<string>, firstLine: string): Tagged {
    for (const tag of listShebangTags(firstLine)) tags.add(tag);
    if (Object.values(INTERPRETER_DIALECTS).some((dialect) => tags.has(dialect))) tags.delete('bash');
    tags.add(TEXT_TAG);
    return { tags: [...tags], isBinary: false };
}

function stripTrailingVersion(word: string): string {
    let end = word.length;
    while (end > 0 && VERSION_CHARACTERS.includes(word[end - 1] ?? '')) end -= 1;
    return word.slice(0, end);
}

/**
 * Resolve the pointer paths that tool files generate outside the tool project.
 * @param path the scope folder.
 * @param files the tool file declarations.
 * @returns the pointer paths and declared folder patterns.
 */
function listPointerDeclarations(path: string, files: ToolFileDeclaration[]): string[] {
    return files.flatMap((file) => {
        const pointer = file.pointer;
        if (pointer === undefined) return [];
        const scope = file.per_scope ? path : '';
        return (pointer.folders ?? ['']).map((folder) => posix.join(scope, folder, pointer.path));
    });
}

/**
 * Detect the generated gspot marker in the opening comment lines.
 * @param text the start of a file.
 * @returns whether the text carries the generated marker.
 */
function hasGeneratedHeader(text: string): boolean {
    const lines = text.split('\n', HEADER_LINES_CHECKED);
    return lines.some((line) => GENERATED_HEADER_LINE.test(line));
}

/**
 * Read the first executable, skipping env and its -S argument when present.
 * @param firstLine the shebang candidate.
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
 * Find the kind of a tracked file and where the kind comes from.
 * @param repositoryRoot the base folder for resolving tracked entries.
 * @param entry the tracked listing item.
 * @param prefix the first bytes of the file.
 * @param inputs the file declarations to match.
 * @returns the kind and its origin.
 */
function classifyFile(
    repositoryRoot: string,
    entry: ListedFile,
    prefix: Buffer,
    inputs: ClassificationInputs,
): TrackedFile {
    const tagged = tagFile(entry, prefix);
    const verdict = classifyKind({ root: repositoryRoot, entry, prefix, isBinary: tagged.isBinary }, inputs);
    return {
        path: entry.path,
        kind: verdict.kind,
        kindOrigin: verdict.origin,
        tags: tagged.tags,
        executable: entry.executable,
        size: entry.size,
    };
}

/**
 * Tag one file. A binary file keeps its path tags and gets no content tags.
 * @param entry the tracked listing item.
 * @param prefix the captured first bytes.
 * @returns the path and content tags, and whether the file contains binary bytes.
 */
function tagFile(entry: ListedFile, prefix: Buffer): Tagged {
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
        ...(EXTENSION_TAGS[extension] ?? []),
        ...(FILENAME_TAGS[base] ?? []),
        ...flags.filter(([isSet]) => isSet).map(([, tag]) => tag),
    ]);
    if (BINARY_EXTENSIONS.has(extension) || prefix.includes(0)) return { tags: [BINARY_TAG, ...tags], isBinary: true };
    const text = prefix.toString('utf8');
    const newline = text.indexOf('\n');
    return tagTextFile(tags, newline === -1 ? text : text.slice(0, newline));
}

/**
 * List the extensions whose inventory tags include any of the tags.
 * @param tags the language or content labels to find.
 * @returns extensions in inventory order.
 */
function listTaggedExtensions(...tags: string[]): string[] {
    return Object.entries(EXTENSION_TAGS)
        .filter(([, owned]) => owned.some((tag) => tags.includes(tag)))
        .map(([extension]) => extension);
}

/**
 * Resolve generated paths of the configurations each scope selects.
 * @param selected the manifests of each written scope.
 * @returns file declarations, with the configuration that declares each.
 */
function listFileDeclarations(selected: Map<string, Manifest[]>): FileDeclaration[] {
    return selected
        .entries()
        .flatMap(([path, manifests]) =>
            manifests.flatMap(({ generated, configuration, toolFiles }) => {
                const paths = [
                    ...generated.map((file) => posix.join(path, file)),
                    ...listPointerDeclarations(path, toolFiles),
                ];
                return paths.length === 0
                    ? []
                    : [
                          {
                              kind: 'generated' as const,
                              configuration: configuration.name,
                              paths,
                          },
                      ];
            }),
        )
        .toArray();
}

/**
 * Check whether a path sits in a gspot tool project.
 * @param path the repository-relative file.
 * @returns whether a .gspot folder contains the file.
 */
function isInGspotFolder(path: string): boolean {
    return path.startsWith(`${DOT_GSPOT}/`);
}

/**
 * Check whether a path sits in a tool project or in installed npm dependencies.
 * @param path the repository-relative file.
 * @returns whether project discovery must leave out the path.
 */
function isInstalledToolPath(path: string): boolean {
    return isInGspotFolder(path) || isInDependencyFolder(path);
}

/**
 * Check whether a path lies inside an installed dependency folder, such as node_modules.
 * @param path the repository-relative path.
 * @returns whether a dependency folder holds it.
 */
function isInDependencyFolder(path: string): boolean {
    return path.split('/').some((part) => INSTALLED_DEPENDENCY_FOLDERS.has(part));
}

export {
    findLockfile,
    classifyFile,
    isInGspotFolder,
    hasGeneratedHeader,
    isInstalledToolPath,
    isInDependencyFolder,
    listTaggedExtensions,
    listFileDeclarations,
};
