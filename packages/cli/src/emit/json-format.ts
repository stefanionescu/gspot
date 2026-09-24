// JSON text the way Prettier prints it: objects one key per line, arrays on one line when they fit.
import type { JsonFormat } from '#cli/types/generation.ts';

function primitive(value: unknown): string | undefined {
    if (value === null || typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (typeof value === 'string') return JSON.stringify(value);
    return undefined;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function oneLine(value: unknown): string | undefined {
    const flat = primitive(value);
    if (flat !== undefined) return flat;
    if (Array.isArray(value)) {
        const parts = value.map((item) => oneLine(item));
        return parts.includes(undefined) ? undefined : `[${parts.join(', ')}]`;
    }
    return isPlainRecord(value) && Object.keys(value).length === 0 ? '{}' : undefined;
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
    if (isPlainRecord(value)) return recordBlock(value, depth, format);
    return primitive(value) ?? 'null';
}

/**
 * The JSON text Prettier produces for a value, ending in a newline.
 * @param value the data
 * @param format the print width and the indent width
 * @returns the text
 */
export function jsonText(value: unknown, format: JsonFormat): string {
    return `${block(value, 0, format, 0)}\n`;
}
