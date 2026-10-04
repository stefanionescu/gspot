import { extname } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { parse as parseToml } from 'smol-toml';
import { isRecord } from '#cli/platform/objects.ts';
import type { ToolPin } from '#cli/types/configurations.ts';
import { TOOL_CONFIGURATION_FORMATS } from '#cli/config/parsers/tool/configuration.ts';

function parseToolFile(text: string, extension: string, path: string): unknown {
    switch (TOOL_CONFIGURATION_FORMATS[extension]) {
        case 'json': {
            return JSON.parse(text) as unknown;
        }
        case 'yaml': {
            return parseYaml(text) as unknown;
        }
        case 'toml': {
            return parseToml(text);
        }
        default: {
            throw new Error(`${path}: shared configuration format is unsupported.`);
        }
    }
}

function hasKeyPath(value: unknown, parts: string[]): boolean {
    let parsed = value;
    for (const part of parts) {
        if (!isRecord(parsed) || !Object.hasOwn(parsed, part)) return false;
        parsed = parsed[part];
    }
    return true;
}

function parseHeader(line: string): string | undefined {
    const trimmed = line.trim();
    const close = trimmed.indexOf(']');
    const tail = close === -1 ? '' : trimmed.slice(close + 1).trim();
    const isHeader =
        trimmed.startsWith('[') && close > 1 && (tail === '' || tail.startsWith('#') || tail.startsWith(';'));
    return isHeader ? trimmed.slice(1, close) : undefined;
}

/**
 * Whether a shared tool config file contains the declared key or table.
 * @param text the authored file text
 * @param path the file path, whose extension names the format
 * @param selector the key or table that the tool owns
 * @returns whether that section exists
 */
export function hasToolSection(
    text: string,
    path: string,
    selector: Pick<NonNullable<ToolPin['replace']>[number], 'key' | 'table'>,
): boolean {
    const extension = extname(path);
    if (selector.table !== undefined && (extension === '.ini' || extension === '.cfg'))
        return getIniSection(text, selector.table) !== undefined;
    const parts = selector.key === undefined ? (selector.table?.split('.') ?? []) : [selector.key];
    return hasKeyPath(parseToolFile(text, extension, path), parts);
}

/**
 * Select one INI section and its colon-delimited subsections without changing their text.
 * @param text the INI text
 * @param section the section name
 * @returns the section text, or undefined when the file has no such section
 */
export function getIniSection(text: string, section: string): string | undefined {
    const seen = new Set<string>();
    let included = false;
    const selected = text.split('\n').flatMap((line) => {
        const header = parseHeader(line);
        if (header === undefined) return included ? [line] : [];
        included = header === section || header.startsWith(`${section}:`);
        if (!included) return [];
        if (seen.has(header)) throw new Error(`Duplicate configuration section: ${header}`);
        seen.add(header);
        return [line];
    });
    return selected.length === 0 ? undefined : selected.join('\n');
}
