import { posix } from 'node:path';
import { ATTRIBUTE_FIELDS } from '#cli/config/parsers/attributes.ts';
import type { AttributeRule } from '#cli/types/parsers/attributes.ts';

/**
 * Read attribute declarations in their file order, preserving quoted paths.
 * @param text the authored gitattributes source
 * @param folder the repository-relative folder containing the declarations
 * @returns selectors rooted in that folder and their declared attributes
 */
export function attributeRules(text: string, folder: string): AttributeRule[] {
    return text.split('\n').flatMap((line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('#')) return [];
        const match = /^("(?:[^"\\]|\\.)*"|\S+)(?:\s+|$)/u.exec(trimmed);
        if (match === null) return [];
        const raw = match[1] ?? '';
        const pattern = raw.startsWith('"') ? (JSON.parse(raw) as string) : raw;
        if (pattern.endsWith('/') || pattern.startsWith('!')) return [];
        const bare = pattern.replace(/^\//u, '');
        const local = bare.includes('/') ? bare : `**/${bare}`;
        return [
            {
                pattern: posix.join(folder, local),
                attributes: trimmed.slice(match[0].length).split(/\s+/u),
            },
        ];
    });
}

/**
 * Apply declarations over inherited attributes, clearing unspecified entries with the ! prefix.
 * @param declarations the attribute tokens from one matching pattern
 * @param previous the attributes inherited from earlier declarations
 * @returns the effective attributes without mutating the inherited table
 */
export function resolvedAttributes(declarations: string[], previous: Record<string, string>): Record<string, string> {
    const resolved = { ...previous };
    for (const match of declarations) {
        const [name = '', value] = match.split('=');
        if (name.startsWith('!')) Reflect.deleteProperty(resolved, name.slice(1));
        else if (name.startsWith('-')) resolved[name.slice(1)] = 'unset';
        else resolved[name] = value ?? 'set';
        if (match === 'binary') Object.assign(resolved, { diff: 'unset', merge: 'unset', text: 'unset' });
    }
    return resolved;
}

/**
 * Parse Git's NUL-delimited path, name, and value triplets without splitting spaces in paths.
 * @param text the successful check-attr -z output
 * @returns the effective attributes per path
 */
export function gitAttributes(text: string): Map<string, Record<string, string>> {
    const fields = text.split('\0');
    const attributes = new Map<string, Record<string, string>>();
    for (let index = 0; index + ATTRIBUTE_FIELDS <= fields.length; index += ATTRIBUTE_FIELDS) {
        const [path, name, value] = fields.slice(index, index + ATTRIBUTE_FIELDS) as [string, string, string];
        let table = attributes.get(path);
        if (table === undefined) table = {};
        table[name] = value;
        attributes.set(path, table);
    }
    return attributes;
}
