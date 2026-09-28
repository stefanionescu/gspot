import JSON5 from 'json5';
import { extname } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { parse as parseToml } from 'smol-toml';
import { parseJsonc } from '#cli/repository/jsonc.ts';
import { iniSection } from '#cli/repository/configuration/ini.ts';

const PARSERS: Record<string, (text: string) => unknown> = {
    '.json': (text) => JSON.parse(text) as unknown,
    '.jsonc': parseJsonc,
    '.json5': (text) => JSON5.parse(text),
    '.yaml': parseYaml,
    '.yml': parseYaml,
    '.toml': parseToml,
};

function selectedValue(
    value: unknown,
    selector: Parameters<typeof configurationSection>[2],
): { parsed: unknown } | undefined {
    const parts = selector.key === undefined ? (selector.table?.split('.') ?? []) : [selector.key];
    let parsed = value;
    for (const part of parts) {
        if (typeof parsed !== 'object' || parsed === null || !Object.hasOwn(parsed, part)) return undefined;
        parsed = (parsed as Record<string, unknown>)[part];
    }
    return { parsed };
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
export function configurationSection(
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
