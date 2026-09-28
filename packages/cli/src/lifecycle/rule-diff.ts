import { isDeepStrictEqual } from 'node:util';
import { parse as parseToml } from 'smol-toml';
import type { GeneratedFile } from '#cli/types/generation.ts';
import { baseName, extensionOf } from '#cli/platform/paths.ts';
import { GENERATED_JSON_KEY } from '#cli/constants/generation.ts';
import { parse as parseJson, type ParseError } from 'jsonc-parser';
import type { DriftEntry } from '#cli/types/lifecycle/lifecycle.ts';
import { gixyRules } from '#cli/repository/configuration/gixy-rules.ts';
import { valeRules } from '#cli/repository/configuration/vale-rules.ts';
import { sqlfluffRules } from '#cli/repository/configuration/sqlfluff.ts';
import { javascriptRules } from '#cli/repository/configuration/javascript-rules.ts';
import { shellcheckRules } from '#cli/repository/configuration/shellcheck-rules.ts';
import { swiftformatRules } from '#cli/repository/configuration/swiftformat-rules.ts';

function jsonDocument(text: string): unknown {
    const errors: ParseError[] = [];
    const value: unknown = parseJson(text, errors);
    if (errors.length > 0) throw new Error('Rule configuration is not valid JSON.');
    return value;
}

const NAMED_READERS: Record<string, (text: string) => unknown> = {
    'gixy.cfg': gixyRules,
    'vale.ini': valeRules,
    'sqlfluff.cfg': sqlfluffRules,
    shellcheckrc: shellcheckRules,
    '.shellcheckrc': shellcheckRules,
    swiftformat: swiftformatRules,
    '.swiftformat': swiftformatRules,
};

const FORMAT_READERS: Record<string, (text: string) => unknown> = {
    '.toml': parseToml,
    '.yaml': Bun.YAML.parse,
    '.yml': Bun.YAML.parse,
    '.json': jsonDocument,
    '.jsonc': jsonDocument,
};

function document(path: string, text: string): unknown {
    const named = NAMED_READERS[baseName(path)];
    if (named !== undefined) return named(text);
    const extension = extensionOf(path);
    if (['.js', '.mjs', '.cjs'].includes(extension)) return javascriptRules(path, text);
    const reader = FORMAT_READERS[extension];
    if (reader !== undefined) return reader(text);
    throw new Error(`Rule comparison does not support ${extension} configurations.`);
}

function ruleList(value: unknown[], path: string): Map<string, unknown> {
    if (value.every((entry) => typeof entry === 'string')) return new Map(value.map((rule: string) => [rule, true]));
    return value.reduce<Map<string, unknown>>((rules, entry) => {
        const id: unknown = typeof entry === 'object' && entry !== null ? Reflect.get(entry, 'id') : undefined;
        if (typeof id !== 'string') throw new Error(`Rule path ${path} must contain records with string IDs.`);
        if (rules.has(id)) throw new Error(`Rule path ${path} contains duplicate ID ${id}.`);
        rules.set(id, entry);
        return rules;
    }, new Map());
}

function rulesAt(parsed: unknown, path: string): Map<string, unknown> {
    const segments = path === '' ? [] : path.split('.');
    const value = segments.reduce<unknown>((table, part) => {
        if (table === undefined) return undefined;
        if (typeof table !== 'object' || table === null) throw new Error(`Rule path ${path} is not a table.`);
        return Reflect.get(table, part);
    }, parsed);
    if (value === undefined || value === null) return new Map();
    if (Array.isArray(value)) return ruleList(value, path);
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
export function compareRules(paths: string[], previous: unknown, proposed: unknown): NonNullable<DriftEntry['rules']> {
    return paths.flatMap((path) => {
        const previousRules = rulesAt(previous, path);
        const next = rulesAt(proposed, path);
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
export function ruleDiff(file: GeneratedFile, before: string | undefined): Pick<DriftEntry, 'rules' | 'ruleError'> {
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
