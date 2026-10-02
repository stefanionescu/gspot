import { posix } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { isDeepStrictEqual } from 'node:util';
import { parse as parseToml } from 'smol-toml';
import { extensionOf } from '#cli/platform/paths.ts';
import { jsoncValue } from '#cli/repository/jsonc.ts';
import type { GeneratedFile } from '#cli/types/kits.ts';
import { parseGixy } from '#cli/lifecycle/preview/gixy.ts';
import { parseVale } from '#cli/lifecycle/preview/vale.ts';
import type { Drift } from '#cli/types/lifecycle/lifecycle.ts';
import { parseSqlfluff } from '#cli/lifecycle/preview/sqlfluff.ts';
import { parseJavascript } from '#cli/lifecycle/preview/javascript.ts';
import { parseShellcheck } from '#cli/lifecycle/preview/shellcheck.ts';
import { parseSwiftformat } from '#cli/lifecycle/preview/swiftformat.ts';
import { GENERATED_JSON_KEY } from '#cli/config/generation/generation.ts';

function parseJsonc(text: string): unknown {
    const value = jsoncValue(text);
    if (value === undefined) throw new Error('Rule configuration is not valid JSON.');
    return value;
}

const PARSERS_BY_NAME: Record<string, (text: string) => unknown> = {
    'gixy.cfg': parseGixy,
    'vale.ini': parseVale,
    'sqlfluff.cfg': parseSqlfluff,
    shellcheckrc: parseShellcheck,
    '.shellcheckrc': parseShellcheck,
    swiftformat: parseSwiftformat,
    '.swiftformat': parseSwiftformat,
};

const PARSERS_BY_EXTENSION: Record<string, (text: string) => unknown> = {
    '.toml': parseToml,
    '.yaml': parseYaml,
    '.yml': parseYaml,
    '.json': parseJsonc,
    '.jsonc': parseJsonc,
};

function document(path: string, text: string): unknown {
    const named = PARSERS_BY_NAME[posix.basename(path)];
    if (named !== undefined) return named(text);
    const extension = extensionOf(path);
    if (['.js', '.mjs', '.cjs'].includes(extension)) return parseJavascript(path, text);
    const reader = PARSERS_BY_EXTENSION[extension];
    if (reader !== undefined) return reader(text);
    throw new Error(`Rule comparison does not support ${extension} configurations.`);
}

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
    if (typeof value === 'object') return new Map(Object.entries(value).filter(([key]) => key !== GENERATED_JSON_KEY));
    throw new Error(`Rule path ${path} must contain a rule list or table.`);
}

/**
 * Compare resolved rule collections using their declared paths.
 * @param paths the key paths that hold rules
 * @param previous the document as it was
 * @param proposed the document as generated
 * @returns the rules added, removed, and changed under each path that differs
 */
export function compareRules(paths: string[], previous: unknown, proposed: unknown): NonNullable<Drift['rules']> {
    return paths.flatMap((path) => {
        const previousRules = getRules(previous, path);
        const next = getRules(proposed, path);
        const added = [...next.keys()]
            .filter((rule) => !previousRules.has(rule))
            .toSorted((left, right) => left.localeCompare(right));
        const removed = [...previousRules.keys()]
            .filter((rule) => !next.has(rule))
            .toSorted((left, right) => left.localeCompare(right));
        const changed = [...next.keys()]
            .filter((rule) => previousRules.has(rule) && !isDeepStrictEqual(previousRules.get(rule), next.get(rule)))
            .toSorted((left, right) => left.localeCompare(right));
        return added.length + removed.length + changed.length === 0 ? [] : [{ path, added, removed, changed }];
    });
}

/**
 * Compare declared rule lists and tables as data, retaining malformed-file diagnostics beside the byte diff.
 * @param file the generated file
 * @param before the file's text as it is now, or undefined when it does not exist
 * @returns the rule differences, or the reason they cannot be read
 */
export function diffRules(file: GeneratedFile, before: string | undefined): Pick<Drift, 'rules' | 'ruleError'> {
    if (file.rulesPath === undefined) return {};
    try {
        const previous = before === undefined ? {} : document(file.path, before);
        const proposed = document(file.path, file.content);
        const rules = compareRules(file.rulesPath, previous, proposed);
        return { rules };
    } catch (error) {
        return {
            ruleError: `Rule comparison failed: ${error instanceof Error ? error.message.split('\n', 1).join('') : String(error)}`,
        };
    }
}
