import { posix } from 'node:path';
import { readText } from '#cli/system/files/reads.ts';
import { extractExtension } from '#cli/system/paths.ts';
import { GITATTRIBUTES_FILE } from '#cli/config/files/names.ts';
import { stripBlock } from '#cli/parsers/formats/managed-blocks.ts';
import { DOT_GSPOT, GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { buildPathMatcher } from '#cli/repository/files/matchers.ts';
import { LOCKFILES } from '#cli/config/parsers/projects/lockfiles.ts';
import { MARKERS } from '#cli/config/parsers/formats/managed-blocks.ts';
import type { ConfigFile, Configuration } from '#cli/types/configurations.ts';
import { JAVASCRIPT_RUNTIMES } from '#cli/config/parsers/projects/dependencies.ts';

import type {
    FileTags,
    ListedFile,
    TrackedFile,
    FileKindRules,
    GeneratedPaths,
    FileClassification,
} from '#cli/types/repository/files.ts';
import {
    TEXT_TAG,
    SET_VALUES,
    LFS_FILTER,
    SCRIPT_TAG,
    BINARY_TAG,
    RUNTIME_TAG,
    SHEBANG_TAG,
    SOURCE_KIND,
    NOTICE_FILE,
    UNSET_VALUE,
    BANNER_BYTES,
    LICENSE_FILE,
    SHEBANG_TAGS,
    KIND_ORIGINS,
    LICENSE_TAGS,
    FILENAME_TAGS,
    DOTENV_PREFIX,
    ATTRIBUTE_SET,
    TEXT_ATTRIBUTE,
    ENV_SPLIT_FLAG,
    SHEBANG_PREFIX,
    EXTENSION_TAGS,
    DEFAULT_DIALECT,
    DOCKERFILE_NAME,
    BUILD_LAUNCHERS,
    FILTER_ATTRIBUTE,
    TRAILING_VERSION,
    VENDORED_FOLDERS,
    BINARY_EXTENSIONS,
    MARKDOWN_EXTENSION,
    VENDORED_ATTRIBUTE,
    GENERATED_ATTRIBUTE,
    DOCKERFILE_EXTENSION,
    HEADER_LINES_CHECKED,
    INTERPRETER_DIALECTS,
    SHEBANG_INTERPRETERS,
    GENERATED_HEADER_LINE,
    ENV_EXECUTABLE_SUFFIX,
    GENERATOR_OUTPUT_BANNERS,
} from '#cli/config/repository/files/classify.ts';

function findConfiguredKind(path: string, rules: FileKindRules): FileClassification | undefined {
    const attribute = findAttributeKind(rules.attributes.get(path));
    if (attribute !== undefined) return attribute;
    const generated = rules.generatedPaths.find((generatedPath) => buildPathMatcher(generatedPath.paths)(path));
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

function isLicenseFile(path: string): boolean {
    const name = posix.basename(path);
    const tags = EXTENSION_TAGS[extractExtension(name)] ?? [];
    return (LICENSE_FILE.test(name) || NOTICE_FILE.test(name)) && tags.every((tag) => LICENSE_TAGS.has(tag));
}

function findGeneratedKind(path: string, prefix: Buffer): FileClassification | undefined {
    if (path.startsWith(`${GSPOT_PATHS.valePackages}/`)) return { kind: 'vendored', origin: KIND_ORIGINS.gspot };
    if (path.startsWith(`${DOT_GSPOT}/`)) return { kind: 'generated', origin: KIND_ORIGINS.gspot };
    if (BUILD_LAUNCHERS.has(posix.basename(path))) return { kind: 'generated', origin: KIND_ORIGINS.buildWrapper };
    const start = prefix.subarray(0, BANNER_BYTES).toString('utf8');
    if (hasGeneratedHeader(start) || GENERATOR_OUTPUT_BANNERS.some((banner) => banner.test(start)))
        return { kind: 'generated', origin: KIND_ORIGINS.banner };
    return undefined;
}

function classifyManagedDocument(root: string, file: ListedFile, prefix: Buffer): FileClassification {
    if (file.symlink || !file.path.endsWith(MARKDOWN_EXTENSION) || !prefix.includes(MARKERS.markdown.start))
        return SOURCE_KIND;
    const text = readText(root, file.path);
    const authored = stripBlock(text, { path: file.path, style: 'markdown' });
    if (authored === text || authored.trim() !== '') return SOURCE_KIND;
    return { kind: 'generated', origin: KIND_ORIGINS.gspot };
}

function classifyKind(
    file: { root: string; listed: ListedFile; prefix: Buffer; isBinary: boolean },
    rules: FileKindRules,
): FileClassification {
    const { root, listed, isBinary, prefix } = file;
    const { path } = listed;
    const configured = findConfiguredKind(path, rules);
    if (configured) return configured;
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
    return classifyManagedDocument(root, listed, prefix);
}

function listShebangTags(firstLine: string): string[] {
    const interpreter = parseShebang(firstLine);
    if (interpreter === undefined) return [];
    const shebang =
        SHEBANG_INTERPRETERS.get(interpreter) ?? SHEBANG_INTERPRETERS.get(interpreter.replace(TRAILING_VERSION, ''));
    if (shebang === undefined) return [];
    const dialect = INTERPRETER_DIALECTS.get(interpreter) ?? DEFAULT_DIALECT;
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
    if (INTERPRETER_DIALECTS.values().some((dialect) => tags.has(dialect))) tags.delete(DEFAULT_DIALECT);
    tags.add(TEXT_TAG);
    return { tags: [...tags], isBinary: false };
}

function listPointers(path: string, files: ConfigFile[]): string[] {
    return files.flatMap((file) => {
        const pointer = file.pointer;
        if (pointer === undefined) return [];
        const scope = file.per_scope ? path : '';
        return (pointer.folders ?? ['']).map((folder) => posix.join(scope, folder, pointer.path));
    });
}

/**
Check whether the first lines of a file hold the gspot header.

@param text the start of a file.
@returns whether the text holds the gspot header.
*/
export function hasGeneratedHeader(text: string): boolean {
    const lines = text.split('\n', HEADER_LINES_CHECKED);
    return lines.some((line) => GENERATED_HEADER_LINE.test(line));
}

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
Build the inventory entry of a tracked file: its kind, where the kind comes from, and its tags.

@param repositoryRoot the base folder for resolving tracked entries.
@param file the tracked listing item.
@param prefix the first bytes of the file.
@param rules the generated and vendored paths to match.
@returns the tracked file.
*/
export function classifyFile(
    repositoryRoot: string,
    file: ListedFile,
    prefix: Buffer,
    rules: FileKindRules,
): TrackedFile {
    const tagged = tagFile(file, prefix);
    const kind = classifyKind({ root: repositoryRoot, listed: file, prefix, isBinary: tagged.isBinary }, rules);
    return {
        path: file.path,
        kind: kind.kind,
        kindOrigin: kind.origin,
        tags: tagged.tags,
        executable: file.executable,
        size: file.size,
    };
}

function tagFile(file: ListedFile, prefix: Buffer): FileTags {
    const extension = extractExtension(file.path);
    const base = posix.basename(file.path);
    const flags: [boolean, string][] = [
        [file.symlink, 'symlink'],
        [LOCKFILES.some((lockfile) => lockfile.file === base), 'lockfile'],
        [base.startsWith(DOCKERFILE_NAME) || extension === DOCKERFILE_EXTENSION, 'dockerfile'],
        [base.startsWith(DOTENV_PREFIX), 'dotenv'],
        [file.executable, 'executable'],
    ];
    const tags = new Set<string>([
        ...(EXTENSION_TAGS[extension] ?? []),
        ...(FILENAME_TAGS.get(base) ?? []),
        ...flags.filter(([isSet]) => isSet).map(([, tag]) => tag),
    ]);
    if (BINARY_EXTENSIONS.has(extension) || prefix.includes(0)) return { tags: [BINARY_TAG, ...tags], isBinary: true };
    const text = prefix.toString('utf8');
    const newline = text.indexOf('\n');
    return tagTextFile(tags, newline === -1 ? text : text.slice(0, newline));
}

/**
List the extensions whose inventory tags include any of the tags.

@param tags the language or content labels to find.
@returns extensions in inventory order.
*/
export function listTaggedExtensions(...tags: string[]): string[] {
    return Object.entries(EXTENSION_TAGS)
        .filter(([, owned]) => owned.some((tag) => tags.includes(tag)))
        .map(([extension]) => extension);
}

/**
Resolve generated paths of the configurations each scope selects.

@param selected the configurations of each written scope.
@returns the generated paths, with the configuration that declares each.
*/
export function listConfigurationGeneratedPaths(selected: Map<string, Configuration[]>): GeneratedPaths[] {
    return selected
        .entries()
        .flatMap(([path, configurations]) =>
            configurations.flatMap(({ generated, name, configFiles }) => {
                const paths = [...generated.map((file) => posix.join(path, file)), ...listPointers(path, configFiles)];
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
List the tracked paths that the current inventory classifies as generated.

@param files the files of the current repository read.
@returns the paths tagged as generated by the inventory.
*/
export function listGeneratedPaths(files: TrackedFile[]): ReadonlySet<string> {
    return new Set(files.filter(({ kind }) => kind === 'generated').map(({ path }) => path));
}
