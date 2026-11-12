import { posix } from 'node:path';

import { GSPOT_PATHS, SHEBANG_TAG } from '#cli/config/manifests.ts';
import { SCRIPT_TAG } from '#cli/config/parsers/code.ts';
import { MARKERS } from '#cli/config/parsers/formats.ts';
import { JAVASCRIPT_RUNTIMES, LOCKFILES } from '#cli/config/parsers/projects.ts';
import {
    BANNER_BYTES,
    BINARY_EXTENSIONS,
    BINARY_TAG,
    BUILD_LAUNCHERS,
    DEFAULT_DIALECT,
    DIFF_ATTRIBUTE,
    DOCKERFILE_EXTENSION,
    DOCKERFILE_NAME,
    DOTENV_PREFIX,
    ENV_EXECUTABLE_SUFFIX,
    ENV_SPLIT_FLAG,
    EXTENSION_TAGS,
    FILENAME_TAGS,
    FILTER_ATTRIBUTE,
    GENERATED_ATTRIBUTE,
    GENERATED_HEADER_LINE,
    GENERATOR_OUTPUT_BANNERS,
    GITATTRIBUTES_FILE,
    HEADER_LINES_CHECKED,
    INTERPRETER_DIALECTS,
    KIND_ORIGINS,
    LFS_FILTER,
    LICENSE_FILE,
    LICENSE_TAGS,
    MARKDOWN_EXTENSION,
    NOTICE_FILE,
    RUNTIME_TAG,
    SET_STATE,
    SET_VALUES,
    SHEBANG_INTERPRETERS,
    SHEBANG_PREFIX,
    SHEBANG_TAGS,
    SOURCE_KIND,
    TEXT_ATTRIBUTE,
    TEXT_TAG,
    TRAILING_VERSION,
    UNSET_STATE,
    VENDORED_ATTRIBUTE,
    VENDORED_FOLDERS,
} from '#cli/config/repository/files.ts';
import { GSPOT_FOLDER, WHITESPACE_RUN } from '#cli/config/system.ts';
import { stripBlock } from '#cli/parsers/formats/managed-blocks.ts';
import { readText } from '#cli/system/files/reads.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { extractExtension, isInScope } from '#cli/system/paths.ts';
import type { Config, Configuration } from '#cli/types/manifests.ts';
import type {
    FileClassification,
    FileKindRules,
    FileTags,
    GeneratedPaths,
    ListedFile,
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
    const authored = stripBlock(text, { path: file.path });
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

function listPointerFiles(path: string, files: Config[]): string[] {
    return files.flatMap((file) => {
        const pointer = file.pointer;
        if (pointer === undefined) return [];
        const scopePath = file.per_scope ? path : '';
        return (pointer.folders ?? ['']).map((folder) => posix.join(scopePath, folder, pointer.path));
    });
}

function parseShebang(firstLine: string): string | undefined {
    if (!firstLine.startsWith(SHEBANG_PREFIX)) return undefined;
    const tokens = firstLine.slice(SHEBANG_PREFIX.length).trim().split(WHITESPACE_RUN);
    let index = 0;
    if (tokens[index]?.endsWith(ENV_EXECUTABLE_SUFFIX) === true) index += 1;
    if (tokens[index] === ENV_SPLIT_FLAG) index += 1;
    const word = tokens[index];
    return word === undefined || word === '' ? undefined : posix.basename(word);
}

function tagFile(file: ListedFile, prefix: Buffer): FileTags {
    const tags = new Set<string>([
        ...listPathTags(file.path),
        ...(file.isSymlink ? ['symlink'] : []),
        ...(file.executable ? ['executable'] : []),
    ]);
    if (BINARY_EXTENSIONS.has(extractExtension(file.path)) || prefix.includes(0))
        return { tags: [BINARY_TAG, ...tags], isBinary: true };
    const text = prefix.toString('utf8');
    const newline = text.indexOf('\n');
    return tagTextFile(tags, newline === -1 ? text : text.slice(0, newline));
}

export function listPathTags(path: string): string[] {
    const extension = extractExtension(path);
    const base = posix.basename(path);
    const flags: Array<[boolean, string]> = [
        [LOCKFILES.some((lockfile) => lockfile.file === base), 'lockfile'],
        [base.startsWith(DOCKERFILE_NAME) || extension === DOCKERFILE_EXTENSION, 'dockerfile'],
        [base.startsWith(DOTENV_PREFIX), 'dotenv'],
    ];
    return [
        ...(EXTENSION_TAGS[extension] ?? []),
        ...(FILENAME_TAGS.get(base) ?? []),
        ...flags.filter(([isSet]) => isSet).map(([, tag]) => tag),
    ];
}

export function isGspotPath(path: string): boolean {
    return path.startsWith(`${GSPOT_FOLDER}/`);
}

export function hasGeneratedHeader(text: string): boolean {
    const lines = text.split('\n', HEADER_LINES_CHECKED);
    return lines.some((line) => GENERATED_HEADER_LINE.test(line));
}

export function classifyFile(root: string, file: ListedFile, prefix: Buffer, rules: FileKindRules): TrackedFile {
    const tagged = tagFile(file, prefix);
    const kind = classifyKind({ root: root, listed: file, prefix, isBinary: tagged.isBinary }, rules);
    return {
        path: file.path,
        kind: kind.kind,
        kindOrigin: kind.origin,
        tags: tagged.tags,
        executable: file.executable,
        size: file.size,
    };
}

export function listTaggedExtensions(...tags: string[]): string[] {
    return Object.entries(EXTENSION_TAGS)
        .filter(([, owned]) => owned.some((tag) => tags.includes(tag)))
        .map(([extension]) => extension);
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
