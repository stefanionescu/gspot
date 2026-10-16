// JSON text the way Prettier prints it: objects one key per line, arrays on one line when they fit.
import { isRecord } from '#cli/system/values.ts';
import { extensionOf } from '#cli/system/paths.ts';
import { DOT_GSPOT } from '#cli/config/system/locations.ts';
import { generatedHeader } from '#cli/parsers/generated-header.ts';
import type { JsonFormat } from '#cli/types/generation/formatting.ts';

import {
    HTML_EXTENSIONS,
    JSON_EXTENSIONS,
    DASH_COMMENT_EXTENSIONS,
    SLASH_COMMENT_EXTENSIONS,
} from '#cli/config/generation/headers.ts';

function primitive(value: unknown): string | undefined {
    if (value === null || typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (typeof value === 'string') return JSON.stringify(value);
    return undefined;
}

function oneLine(value: unknown): string | undefined {
    const flat = primitive(value);
    if (flat !== undefined) return flat;
    if (Array.isArray(value)) {
        const parts = value.map((entry) => oneLine(entry));
        return parts.includes(undefined) ? undefined : `[${parts.join(', ')}]`;
    }
    return isRecord(value) && Object.keys(value).length === 0 ? '{}' : undefined;
}

function wrapped(open: string, lines: string[], close: string, depth: number, format: JsonFormat): string {
    const pad = ' '.repeat(format.indent * (depth + 1));
    const body = lines.map((line) => `${pad}${line}`).join(',\n');
    return `${open}\n${body}\n${' '.repeat(format.indent * depth)}${close}`;
}

function arrayBlock(value: unknown[], depth: number, format: JsonFormat, room: number): string {
    if (value.length === 0) return '[]';
    const flat = oneLine(value);
    if (flat !== undefined && flat.length <= room) return flat;
    const last = value.length - 1;
    return wrapped(
        '[',
        value.map((item, index) => block(item, depth + 1, format, index === last ? 0 : 1)),
        ']',
        depth,
        format,
    );
}

function recordBlock(value: Record<string, unknown>, depth: number, format: JsonFormat): string {
    const entries = Object.entries(value);
    if (entries.length === 0) return '{}';
    const last = entries.length - 1;
    const lines = entries.map(([key, item], index) => {
        const prefix = `${JSON.stringify(key)}: `;
        return `${prefix}${block(item, depth + 1, format, prefix.length + (index === last ? 0 : 1))}`;
    });
    return wrapped('{', lines, '}', depth, format);
}

function block(value: unknown, depth: number, format: JsonFormat, taken: number): string {
    if (Array.isArray(value)) return arrayBlock(value, depth, format, format.width - format.indent * depth - taken);
    if (isRecord(value)) return recordBlock(value, depth, format);
    return primitive(value) ?? 'null';
}

function commented(lines: string[], mark: string): string {
    const marked = lines.map((line) => `${mark} ${line}`).join('\n');
    return `${marked}\n`;
}

/**
 * The JSON text Prettier produces for a value, ending in a newline.
 *
 * @param value the data.
 * @param format the print width and the indent width.
 *
 * @returns the text.
 */
export function jsonText(value: unknown, format: JsonFormat): string {
    return `${block(value, 0, format, 0)}\n`;
}

/**
 * The generated notice as comments beginning with `#`.
 * @returns the comment block ending in a newline.
 */
export function hashCommentHeader(): string {
    return commented(generatedHeader(), '#');
}

/**
 * The generated notice outside .gspot, or an empty string for JSON.
 *
 * @param path the target path.
 *
 * @returns the comment block ending in a newline, or ''.
 */
export function headerFor(path: string): string {
    if (path.startsWith(`${DOT_GSPOT}/`)) return '';
    const extension = extensionOf(path);
    if (JSON_EXTENSIONS.has(extension)) return '';
    if (SLASH_COMMENT_EXTENSIONS.has(extension)) return commented(generatedHeader(), '//');
    if (HTML_EXTENSIONS.has(extension)) {
        const indented = generatedHeader()
            .map((line) => `  ${line}`)
            .join('\n');
        return `<!--\n${indented}\n-->\n`;
    }
    if (DASH_COMMENT_EXTENSIONS.has(extension)) return commented(generatedHeader(), '--');
    return hashCommentHeader();
}
