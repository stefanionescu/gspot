import { posix } from 'node:path';
import { readText } from '#cli/system/files/reads.ts';
import { extractExtension } from '#cli/system/paths.ts';
import { stripBlock } from '#cli/parsers/managed-blocks.ts';
import { LOCKFILES } from '#cli/config/parsers/lockfiles.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { MARKERS } from '#cli/config/parsers/managed-blocks.ts';
import { GITATTRIBUTES_FILE } from '#cli/config/repository/tracked.ts';
import { JAVASCRIPT_RUNTIMES } from '#cli/config/parsers/dependencies.ts';
import { DOT_GSPOT, VALE_PACKAGES_PATH } from '#cli/config/gspot-paths.ts';
import type { ToolFile, Configuration } from '#cli/types/configurations.ts';
import { HEADER_LINES_CHECKED, GENERATED_HEADER_LINE } from '#cli/config/generation/header.ts';

import type {
    FileTags,
    ListedFile,
    TrackedFile,
    FileKindRules,
    GeneratedPaths,
    FileClassification,
} from '#cli/types/repository/inventory.ts';
import {
    TEXT_TAG,
    BINARY_TAG,
    LFS_FILTER,
    SCRIPT_TAG,
    SET_VALUES,
    NOTICE_FILE,
    RUNTIME_TAG,
    SHEBANG_TAG,
    SOURCE_KIND,
    UNSET_VALUE,
    BANNER_BYTES,
    KIND_ORIGINS,
    LICENSE_FILE,
    LICENSE_TAGS,
    SHEBANG_TAGS,
    ATTRIBUTE_SET,
    DOTENV_PREFIX,
    FILENAME_TAGS,
    ENV_SPLIT_FLAG,
    EXTENSION_TAGS,
    SHEBANG_PREFIX,
    TEXT_ATTRIBUTE,
    BUILD_LAUNCHERS,
    DEFAULT_DIALECT,
    DOCKERFILE_NAME,
    FILTER_ATTRIBUTE,
    TRAILING_VERSION,
    VENDORED_FOLDERS,
    BINARY_EXTENSIONS,
    MARKDOWN_EXTENSION,
    VENDORED_ATTRIBUTE,
    GENERATED_ATTRIBUTE,
    DOCKERFILE_EXTENSION,
    INTERPRETER_DIALECTS,
    SHEBANG_INTERPRETERS,
    ENV_EXECUTABLE_SUFFIX,
    GENERATOR_OUTPUT_BANNERS,
} from '#cli/config/repository/inventory.ts';

// A Git attribute wins over a configuration declaration.
function findDeclaredKind(path: string, rules: FileKindRules): FileClassification | undefined {
    const attribute = findAttributeKind(rules.attributes.get(path));
    if (attribute !== undefined) return attribute;
    const generated = rules.generatedPaths.find((entry) => buildPathMatcher(entry.paths)(path));
    return generated === undefined ? undefined : { kind: generated.kind, origin: generated.configuration };
}

function findAttributeKind(attributes: Record<string, string> | undefined): FileClassification | undefined {
    if (attributes === undefined) return undefined;
    const generated = attributes[GENERATED_ATTRIBUTE];
    if (generated !== undefined && SET_VALUES.has(generated)) return { kind: 'generated', origin: GITATTRIBUTES_FILE };
    const vendored = attributes[VENDORED_ATTRIBUTE];
    if (vendored !== undefined && SET_VALUES.has(vendored)) return { kind: 'vendored', origin: GITATTRIBUTES_FILE };
    const isBinary = attributes[TEXT_ATTRIBUTE] === UNSET_VALUE || attributes[FILTER_ATTRIBUTE] === LFS_FILTER;
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
    if (path.startsWith(`${VALE_PACKAGES_PATH}/`)) return { kind: 'vendored', origin: KIND_ORIGINS.gspot };
    if (path.startsWith(`${DOT_GSPOT}/`)) return { kind: 'generated', origin: KIND_ORIGINS.gspot };
    if (BUILD_LAUNCHERS.has(posix.basename(path))) return { kind: 'generated', origin: KIND_ORIGINS.buildWrapper };
    const start = prefix.subarray(0, BANNER_BYTES).toString('utf8');
    if (hasGeneratedHeader(start) || GENERATOR_OUTPUT_BANNERS.some((banner) => banner.test(start)))
        return { kind: 'generated', origin: KIND_ORIGINS.banner };
    return undefined;
}

// A Markdown file that holds only a managed block counts as generated; any authored text keeps it source.
function classifyManagedDocument(root: string, entry: ListedFile, prefix: Buffer): FileClassification {
    if (entry.symlink || !entry.path.endsWith(MARKDOWN_EXTENSION) || !prefix.includes(MARKERS.markdown.start))
        return SOURCE_KIND;
    const text = readText(root, entry.path);
    const authored = stripBlock(text, { path: entry.path, style: 'markdown' });
    if (authored === text || authored.trim() !== '') return SOURCE_KIND;
    return { kind: 'generated', origin: KIND_ORIGINS.gspot };
}

/**
 * Classify a file by these sources, in order: attributes, the paths that configurations declare, binary content, license
 * files, gspot paths, generated paths, banners, vendored folders, and managed documents.
 *
 * @param file what to classify.
 * @param file.root the repository folder.
 * @param file.entry the tracked listing item.
 * @param file.prefix the first bytes of the file.
 * @param file.isBinary whether those bytes hold binary data.
 * @param rules the generated and vendored paths that configurations declare, and the captured Git attributes.
 * @returns the kind and where it came from.
 */
function classifyKind(
    file: { root: string; entry: ListedFile; prefix: Buffer; isBinary: boolean },
    rules: FileKindRules,
): FileClassification {
    const { root, entry, isBinary, prefix } = file;
    const { path } = entry;
    const declared = findDeclaredKind(path, rules);
    if (declared) return declared;
    // Explicit text attributes override binary content and what the extension suggests.
    if (isBinary && rules.attributes.get(path)?.[TEXT_ATTRIBUTE] !== ATTRIBUTE_SET)
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
        return { kind: 'vendored', origin: KIND_ORIGINS.directory };
    return classifyManagedDocument(root, entry, prefix);
}

function listShebangTags(firstLine: string): string[] {
    const interpreter = parseShebang(firstLine);
    if (interpreter === undefined) return [];
    const shebang =
        SHEBANG_INTERPRETERS[interpreter] ?? SHEBANG_INTERPRETERS[interpreter.replace(TRAILING_VERSION, '')];
    if (shebang === undefined) return [];
    const dialect = INTERPRETER_DIALECTS[interpreter] ?? DEFAULT_DIALECT;
    const runtime = JAVASCRIPT_RUNTIMES.find((name) => name === interpreter);
    return [
        ...(SHEBANG_TAGS[shebang] ?? []),
        `${SHEBANG_TAG}${shebang}`,
        ...(shebang === SCRIPT_TAG ? [dialect] : []),
        ...(runtime === undefined ? [] : [`${RUNTIME_TAG}${runtime}`]),
    ];
}

function tagTextFile(tags: Set<string>, firstLine: string): FileTags {
    for (const tag of listShebangTags(firstLine)) tags.add(tag);
    if (Object.values(INTERPRETER_DIALECTS).some((dialect) => tags.has(dialect))) tags.delete(DEFAULT_DIALECT);
    tags.add(TEXT_TAG);
    return { tags: [...tags], isBinary: false };
}

/**
 * Resolve the pointer paths that tool files generate outside the tool project.
 *
 * @param path the scope folder.
 * @param files the tool files.
 * @returns the pointer paths and declared folder patterns.
 */
function listPointers(path: string, files: ToolFile[]): string[] {
    return files.flatMap((file) => {
        const pointer = file.pointer;
        if (pointer === undefined) return [];
        const scope = file.per_scope ? path : '';
        return (pointer.folders ?? ['']).map((folder) => posix.join(scope, folder, pointer.path));
    });
}

/**
 * Check whether the first lines of a file hold the gspot header.
 *
 * @param text the start of a file.
 * @returns whether the text holds the gspot header.
 */
export function hasGeneratedHeader(text: string): boolean {
    const lines = text.split('\n', HEADER_LINES_CHECKED);
    return lines.some((line) => GENERATED_HEADER_LINE.test(line));
}

/**
 * Read the first executable, skipping env and its -S argument when present.
 *
 * @param firstLine the first line, which can hold a shebang.
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
 * Build the inventory entry of a tracked file: its kind, where the kind comes from, and its tags.
 *
 * @param repositoryRoot the base folder for resolving tracked entries.
 * @param entry the tracked listing item.
 * @param prefix the first bytes of the file.
 * @param rules the generated and vendored paths to match.
 * @returns the tracked file.
 */
export function classifyFile(
    repositoryRoot: string,
    entry: ListedFile,
    prefix: Buffer,
    rules: FileKindRules,
): TrackedFile {
    const tagged = tagFile(entry, prefix);
    const kind = classifyKind({ root: repositoryRoot, entry, prefix, isBinary: tagged.isBinary }, rules);
    return {
        path: entry.path,
        kind: kind.kind,
        kindOrigin: kind.origin,
        tags: tagged.tags,
        executable: entry.executable,
        size: entry.size,
    };
}

/**
 * Tag one file. A binary file keeps its path tags and gets no content tags.
 *
 * @param entry the tracked listing item.
 * @param prefix the captured first bytes.
 * @returns the path and content tags, and whether the file contains binary bytes.
 */
function tagFile(entry: ListedFile, prefix: Buffer): FileTags {
    const extension = extractExtension(entry.path);
    const base = posix.basename(entry.path);
    const flags: [boolean, string][] = [
        [entry.symlink, 'symlink'],
        [LOCKFILES.some((entry) => entry.file === base), 'lockfile'],
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
 *
 * @param tags the language or content labels to find.
 * @returns extensions in inventory order.
 */
export function listTaggedExtensions(...tags: string[]): string[] {
    return Object.entries(EXTENSION_TAGS)
        .filter(([, owned]) => owned.some((tag) => tags.includes(tag)))
        .map(([extension]) => extension);
}

/**
 * Resolve generated paths of the configurations each scope selects.
 *
 * @param selected the configurations of each written scope.
 * @returns the generated paths, with the configuration that declares each.
 */
export function listConfigurationGeneratedPaths(selected: Map<string, Configuration[]>): GeneratedPaths[] {
    return selected
        .entries()
        .flatMap(([path, configurations]) =>
            configurations.flatMap(({ generated, name, toolFiles }) => {
                const paths = [...generated.map((file) => posix.join(path, file)), ...listPointers(path, toolFiles)];
                return paths.length === 0
                    ? []
                    : [
                          {
                              kind: 'generated' as const,
                              configuration: name,
                              paths,
                          },
                      ];
            }),
        )
        .toArray();
}

/**
 * List the tracked paths that the current inventory classifies as generated.
 *
 * @param files the files of the current repository read.
 * @returns the paths tagged as generated by the inventory.
 */
export function listGeneratedPaths(files: TrackedFile[]): ReadonlySet<string> {
    return new Set(files.filter(({ kind }) => kind === 'generated').map(({ path }) => path));
}
