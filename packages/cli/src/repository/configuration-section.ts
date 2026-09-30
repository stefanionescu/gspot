import { extname } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { parse as parseToml } from 'smol-toml';
import { parseJsonc } from '#cli/repository/jsonc.ts';

const PARSERS: Record<string, (text: string) => unknown> = {
    '.json': (text) => JSON.parse(text) as unknown,
    '.jsonc': parseJsonc,
    '.json5': parseJsonc,
    '.yaml': parseYaml,
    '.yml': parseYaml,
    '.toml': parseToml,
};

function selectedValue(value: unknown, selector: Parameters<typeof kitSection>[2]): { parsed: unknown } | undefined {
    const parts = selector.key === undefined ? (selector.table?.split('.') ?? []) : [selector.key];
    let parsed = value;
    for (const part of parts) {
        if (typeof parsed !== 'object' || parsed === null || !Object.hasOwn(parsed, part)) return undefined;
        parsed = (parsed as Record<string, unknown>)[part];
    }
    return { parsed };
}

function sectionName(line: string): string | undefined {
    const trimmed = line.trim();
    const close = trimmed.indexOf(']');
    const tail = close === -1 ? '' : trimmed.slice(close + 1).trim();
    const isHeader =
        trimmed.startsWith('[') && close > 1 && (tail === '' || tail.startsWith('#') || tail.startsWith(';'));
    return isHeader ? trimmed.slice(1, close) : undefined;
}

/**
 * Select an owned key or table while keeping the shared document available for exact recovery.
 * @param text the file text.
 * @param path the file path, whose extension names the format.
 * @param selector the key or table the tool owns.
 * @param selector.key the top-level key.
 * @param selector.table the table.
 * @returns the section's text and parsed value, or undefined when the file has none.
 */
export function kitSection(
    text: string,
    path: string,
    selector: { key?: string; table?: string },
): { text: string; parsed: unknown } | undefined {
    const extension = extname(path);
    if (selector.table !== undefined && (extension === '.ini' || extension === '.cfg')) {
        const selected = iniSection(text, selector.table);
        return selected === undefined ? undefined : { text: selected, parsed: {} };
    }
    const parse = PARSERS[extension];
    if (parse === undefined) throw new Error(`${path}: shared configuration format is unsupported.`);
    const selected = selectedValue(parse(text), selector);
    return selected === undefined ? undefined : { text, ...selected };
}

/**
 * Select one INI section and its colon-delimited subsections without changing their text.
 * @param text the INI text
 * @param section the section name
 * @returns the section text, or undefined when the file has no such section
 */
export function iniSection(text: string, section: string): string | undefined {
    const seen = new Set<string>();
    let included = false;
    const selected = text.split('\n').flatMap((line) => {
        const header = sectionName(line);
        if (header === undefined) return included ? [line] : [];
        included = header === section || header.startsWith(`${section}:`);
        if (!included) return [];
        if (seen.has(header)) throw new Error(`Duplicate configuration section: ${header}`);
        seen.add(header);
        return [line];
    });
    return selected.length === 0 ? undefined : selected.join('\n');
}
