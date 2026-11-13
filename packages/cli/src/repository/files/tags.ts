import { posix } from 'node:path';

import { SHEBANG_TAG } from '#cli/config/manifests.ts';
import { JAVASCRIPT_RUNTIMES, LOCKFILES } from '#cli/config/parsers/projects.ts';
import {
    BINARY_EXTENSIONS,
    BINARY_TAG,
    DEFAULT_DIALECT,
    DOCKERFILE_EXTENSION,
    DOCKERFILE_NAME,
    DOTENV_PREFIX,
    ENV_EXECUTABLE_SUFFIX,
    ENV_SPLIT_FLAG,
    EXTENSION_TAGS,
    FILENAME_TAGS,
    INTERPRETER_DIALECTS,
    RUNTIME_TAG,
    SCRIPT_TAG,
    SHEBANG_INTERPRETERS,
    SHEBANG_PREFIX,
    SHEBANG_TAGS,
    TEXT_TAG,
    TRAILING_VERSION,
} from '#cli/config/repository/files.ts';
import { WHITESPACE_RUN } from '#cli/config/system.ts';
import { extractExtension } from '#cli/system/paths.ts';
import type { FileTags, ListedFile } from '#cli/types/repository.ts';

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

function parseShebang(firstLine: string): string | undefined {
    if (!firstLine.startsWith(SHEBANG_PREFIX)) return undefined;
    const tokens = firstLine.slice(SHEBANG_PREFIX.length).trim().split(WHITESPACE_RUN);
    let index = 0;
    if (tokens[index]?.endsWith(ENV_EXECUTABLE_SUFFIX) === true) index += 1;
    if (tokens[index] === ENV_SPLIT_FLAG) index += 1;
    const word = tokens[index];
    return word === undefined || word === '' ? undefined : posix.basename(word);
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

export function tagFile(file: ListedFile, prefix: Buffer): FileTags {
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

export function listTaggedExtensions(...tags: string[]): string[] {
    return Object.entries(EXTENSION_TAGS)
        .filter(([, owned]) => owned.some((tag) => tags.includes(tag)))
        .map(([extension]) => extension);
}
