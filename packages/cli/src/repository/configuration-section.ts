import JSON5 from 'json5';
import { extname } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { parse as parseToml } from 'smol-toml';
import { iniSection } from '#cli/repository/ini.ts';
import { parseJsonc } from '#cli/repository/jsonc.ts';

const PARSERS: Record<string, (text: string) => unknown> = {
    '.json': (text) => JSON.parse(text) as unknown,
    '.jsonc': parseJsonc,
    '.json5': (text) => JSON5.parse(text),
    '.yaml': parseYaml,
    '.yml': parseYaml,
    '.toml': parseToml,
};

/**
 * Select an owned key or table while keeping the shared document available for exact recovery.
 * @param text
 * @param path
 * @param selector
 * @param selector.key
 * @param selector.table
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
    let value = parse(text);
    const parts = selector.key === undefined ? (selector.table?.split('.') ?? []) : [selector.key];
    for (const part of parts) {
        if (typeof value !== 'object' || value === null || !Object.hasOwn(value, part)) return undefined;
        value = (value as Record<string, unknown>)[part];
    }
    return { text, parsed: value };
}

export type TomlTable = Record<string, unknown>;
