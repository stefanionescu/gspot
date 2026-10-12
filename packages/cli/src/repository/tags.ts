// Assigns content and extension tags to repository files.
import { posix } from 'node:path';
import { extensionOf } from '#cli/system/paths.ts';
import { parseShebang } from '#cli/parsers/shebang.ts';
import { lockfileEntry } from '#cli/parsers/lockfiles.ts';
import { JAVASCRIPT_RUNTIMES } from '#cli/config/parsers/dependency-files.ts';
import type { Tagged, FileEntry, ContentPrefix } from '#cli/types/repository/inventory.ts';

import {
    TEXT_TAG,
    BINARY_TAG,
    RUNTIME_TAG,
    SHEBANG_TAG,
    SHEBANG_TAGS,
    DOTENV_PREFIX,
    FILENAME_TAGS,
    EXTENSION_TAGS,
    DEFAULT_DIALECT,
    DOCKERFILE_NAME,
    BINARY_EXTENSIONS,
    VERSION_CHARACTERS,
    DOCKERFILE_EXTENSION,
    INTERPRETER_DIALECTS,
    SHEBANG_INTERPRETERS,
} from '#cli/config/repository/inventory.ts';

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
 * Tags for one entry. Binary files retain path tags and do not receive content tags.
 * @param entry the tracked entry.
 * @param prefix the captured first bytes.
 * @returns the path and content tags, and whether the file contains binary bytes.
 */
export function tagEntry(entry: FileEntry, prefix: Buffer): Tagged {
    const extension = extensionOf(entry.path);
    const base = posix.basename(entry.path);
    const flags: [boolean, string][] = [
        [entry.symlink, 'symlink'],
        [lockfileEntry(base) !== undefined, 'lockfile'],
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
export function extensionsTagged(...tags: string[]): string[] {
    return Object.entries(EXTENSION_TAGS)
        .filter(([, owned]) => tags.some((tag) => new Set<string>(owned).has(tag)))
        .map(([extension]) => extension);
}
