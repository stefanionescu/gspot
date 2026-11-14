import { posix } from 'node:path';
import { readText } from '#cli/system/files/reads.ts';
import type { Files, RunCache } from '#cli/types/system.ts';
import type { AttributePattern } from '#cli/types/repository.ts';
import { GITATTRIBUTES_FILE } from '#cli/config/parsers/formats.ts';
import { OCTAL_RADIX, LEADING_SLASH, WHITESPACE_RUN } from '#cli/config/system.ts';
import { stripBlock, findBlockBody } from '#cli/parsers/formats/managed-blocks.ts';

import {
    SET_STATE,
    SET_VALUES,
    UNSET_STATE,
    VENDORED_ATTRIBUTE,
    GENERATED_ATTRIBUTE,
} from '#cli/config/repository/files.ts';
import {
    PATH_ESCAPES,
    ATTRIBUTE_LINE,
    OCTAL_PATH_BYTE,
    ATTRIBUTE_FIELDS,
    ANY_FOLDER_PREFIX,
    QUOTED_PATH_CHUNKS,
    IGNORED_ATTRIBUTE_LINE,
    QUOTED_ATTRIBUTE_PATTERN,
    IGNORED_ATTRIBUTE_PATTERN,
    ATTRIBUTE_ASSIGNMENT_SIDES,
} from '#cli/config/repository/git.ts';

function decodeQuotedPattern(pattern: string): string | undefined {
    if (!QUOTED_ATTRIBUTE_PATTERN.test(pattern)) return undefined;
    const bytes: Buffer[] = [];
    const chunks = pattern.slice(1, -1).matchAll(QUOTED_PATH_CHUNKS);
    for (const [chunk] of chunks) {
        if (!chunk.startsWith('\\')) {
            bytes.push(Buffer.from(chunk));
            continue;
        }
        if (OCTAL_PATH_BYTE.test(chunk)) {
            const value = Number.parseInt(chunk.slice(1), OCTAL_RADIX);
            bytes.push(Buffer.from([value]));
            continue;
        }
        const decoded = PATH_ESCAPES[chunk.slice(1)];
        if (decoded === undefined) return undefined;
        bytes.push(Buffer.from(decoded));
    }
    return Buffer.concat(bytes).toString('utf8');
}

function listSetPatterns(text: string, folder: string, names: readonly string[]): string[] {
    return parseAttributePatterns(text, folder)
        .filter((rule) =>
            Object.entries(mergeAttributes(rule.attributes)).some(
                ([name, value]) => names.includes(name) && SET_VALUES.has(value),
            ),
        )
        .map((rule) => rule.pattern);
}

function buildAttributePattern(match: RegExpExecArray, line: string, folder: string): AttributePattern[] {
    const quoted = match[1] as string;
    const pattern = quoted.startsWith('"') ? decodeQuotedPattern(quoted) : quoted;
    if (pattern === undefined || IGNORED_ATTRIBUTE_PATTERN.test(pattern)) return [];
    const bare = pattern.replace(LEADING_SLASH, '');
    const local = LEADING_SLASH.test(pattern) || bare.includes('/') ? bare : `${ANY_FOLDER_PREFIX}${bare}`;
    return [
        {
            pattern: posix.join(folder, local),
            attributes: line.slice(match[0].length).split(WHITESPACE_RUN).filter(Boolean),
        },
    ];
}

export function parseAttributePatterns(text: string, folder: string): AttributePattern[] {
    return text.split('\n').flatMap((line) => {
        const trimmed = line.trim();
        if (IGNORED_ATTRIBUTE_LINE.test(trimmed)) return [];
        const match = ATTRIBUTE_LINE.exec(trimmed);
        return match === null ? [] : buildAttributePattern(match, trimmed, folder);
    });
}

export function mergeAttributes(tokens: string[]): Record<string, string> {
    const attributes = new Map<string, string>();
    for (const match of tokens) {
        const [name = '', value = SET_STATE] = match.split('=', ATTRIBUTE_ASSIGNMENT_SIDES);
        if (name.startsWith('!')) attributes.delete(name.slice(1));
        else if (name.startsWith('-')) attributes.set(name.slice(1), UNSET_STATE);
        else attributes.set(name, value);
    }
    return Object.fromEntries(attributes);
}

export function parsePathAttributes(text: string): Map<string, Record<string, string>> {
    const fields = text.split('\0');
    const attributes = new Map<string, Record<string, string>>();
    for (let index = 0; index + ATTRIBUTE_FIELDS <= fields.length; index += ATTRIBUTE_FIELDS) {
        const [path, name, value] = fields.slice(index, index + ATTRIBUTE_FIELDS) as [string, string, string];
        const table = { ...attributes.get(path), [name]: value };
        attributes.set(path, table);
    }
    return attributes;
}

/**
List the linguist-generated patterns of the block that gspot writes in the root .gitattributes. Only this block makes a
file gspot's to replace or delete, so a line that the user wrote never does.
*/
export function readGspotGeneratedPatterns(files: Files): string[] {
    const attributesFile = files.read(GITATTRIBUTES_FILE);
    if (attributesFile === undefined) return [];
    const block = findBlockBody(attributesFile.bytes.toString('utf8'), GITATTRIBUTES_FILE) ?? '';
    return listSetPatterns(block, '.', [GENERATED_ATTRIBUTE]);
}

/**
List the generated and vendored patterns that the user wrote in each tracked .gitattributes file, outside the block that
gspot writes.
*/
export function readAuthoredLinguistPatterns(cache: RunCache, paths: string[]): string[] {
    return [
        ...new Set(
            paths
                .filter((path) => posix.basename(path) === GITATTRIBUTES_FILE)
                .flatMap((path) =>
                    listSetPatterns(stripBlock(readText(cache, path), path), posix.dirname(path), [
                        GENERATED_ATTRIBUTE,
                        VENDORED_ATTRIBUTE,
                    ]),
                ),
        ),
    ];
}
