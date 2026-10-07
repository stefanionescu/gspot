import type { CapturedRules } from '#cli/types/generation/rules.ts';
import { ruleSettingsSchema } from '#cli/parsers/schema/tool-rule.ts';

// The string id of a rule record, or an error naming the path that holds something else.
function ruleId(entry: unknown, path: string): string {
    const id: unknown = typeof entry === 'object' && entry !== null ? Reflect.get(entry, 'id') : undefined;
    if (typeof id !== 'string') throw new Error(`Rule path ${path} must contain records with string IDs.`);
    return id;
}

// The value at a dotted path inside parsed configuration, or undefined once a segment is absent.
function getTable(parsed: unknown, segments: string[], path: string): unknown {
    let value: unknown = parsed;
    for (const part of segments) {
        if (value === undefined) break;
        if (typeof value !== 'object' || value === null) throw new Error(`Rule path ${path} is not a table.`);
        value = Reflect.get(value, part);
    }
    return value;
}

function mapRules(value: unknown[], path: string): Map<string, unknown> {
    if (value.every((entry) => typeof entry === 'string')) return new Map(value.map((rule: string) => [rule, true]));
    const rules = new Map<string, unknown>();
    for (const entry of value) {
        const id = ruleId(entry, path);
        if (rules.has(id)) throw new Error(`Rule path ${path} contains duplicate ID ${id}.`);
        rules.set(id, entry);
    }
    return rules;
}

function getRules(parsed: unknown, path: string): Map<string, unknown> {
    const segments = path === '' ? [] : path.split('.');
    const value = getTable(parsed, segments, path);
    if (value === undefined || value === null) return new Map();
    if (Array.isArray(value)) return mapRules(value, path);
    if (typeof value === 'object') return new Map(Object.entries(value));
    throw new Error(`Rule path ${path} must contain a rule list or table.`);
}

/**
 * Collect rule tables from generation data before the tool's serializer runs.
 * @param paths manifest paths naming rule tables or lists
 * @param document the configuration data being generated
 * @returns comparable JSON rule values, grouped by their manifest paths
 */
export function collectRules(paths: string[], document: unknown): CapturedRules {
    return ruleSettingsSchema.parse(
        Object.fromEntries(paths.map((path) => [path, Object.fromEntries(getRules(document, path))])),
    );
}
