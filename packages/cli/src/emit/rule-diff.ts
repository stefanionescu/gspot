import { parse as parseJson, type ParseError } from 'jsonc-parser';
import { parse as parseToml } from 'smol-toml';
import { isDeepStrictEqual } from 'node:util';
import { baseName, extensionOf } from '#cli/platform/paths.ts';
import { shellcheckRules } from '#cli/repository/shellcheck-rules.ts';
import { swiftformatRules } from '#cli/emit/swiftformat-rules.ts';
import { sqlfluffRules } from '#cli/repository/sqlfluff.ts';
import { valeRules } from '#cli/emit/vale-rules.ts';
import { javascriptRules } from '#cli/emit/javascript-rules.ts';
import { gixyRules } from '#cli/emit/gixy-rules.ts';
import { GENERATED_JSON_KEY } from '#cli/emit/markers.ts';
import type { DriftEntry, GeneratedFile } from '#cli/types/generation.ts';

function document(path: string, text: string): unknown {
    if (baseName(path) === 'gixy.cfg') return gixyRules(text);
    if (baseName(path) === 'vale.ini') return valeRules(text);
    if (baseName(path) === 'sqlfluff.cfg') return sqlfluffRules(text);
    if (baseName(path) === 'shellcheckrc' || baseName(path) === '.shellcheckrc') return shellcheckRules(text);
    if (baseName(path) === 'swiftformat' || baseName(path) === '.swiftformat') return swiftformatRules(text);
    const extension = extensionOf(path);
    if (extension === '.js' || extension === '.mjs' || extension === '.cjs') return javascriptRules(path, text);
    if (extension === '.toml') return parseToml(text);
    if (extension === '.yaml' || extension === '.yml') return Bun.YAML.parse(text);
    if (extension === '.json' || extension === '.jsonc') {
        const errors: ParseError[] = [];
        const value: unknown = parseJson(text, errors);
        if (errors.length > 0) throw new Error('Rule configuration is not valid JSON.');
        return value;
    }
    throw new Error(`Rule comparison does not support ${extension} configurations.`);
}

function rulesAt(parsed: unknown, path: string): Map<string, unknown> {
    let value = parsed;
    for (const part of path === '' ? [] : path.split('.')) {
        if (value === undefined) return new Map();
        if (typeof value !== 'object' || value === null) throw new Error(`Rule path ${path} is not a table.`);
        value = Reflect.get(value, part);
    }
    if (value === undefined || value === null) return new Map();
    if (Array.isArray(value) && value.every((entry) => typeof entry === 'string'))
        return new Map(value.map((rule: string) => [rule, true]));
    if (Array.isArray(value)) {
        const rules = new Map<string, unknown>();
        for (const entry of value) {
            const id: unknown = typeof entry === 'object' && entry !== null ? Reflect.get(entry, 'id') : undefined;
            if (typeof id !== 'string') throw new Error(`Rule path ${path} must contain records with string IDs.`);
            if (rules.has(id)) throw new Error(`Rule path ${path} contains duplicate ID ${id}.`);
            rules.set(id, entry);
        }
        return rules;
    }
    if (typeof value === 'object' && !Array.isArray(value))
        return new Map(Object.entries(value).filter(([key]) => key !== GENERATED_JSON_KEY));
    throw new Error(`Rule path ${path} must contain a rule list or table.`);
}

/** Compare resolved rule collections using their declared paths. */
export function compareRules(paths: string[], previous: unknown, proposed: unknown): NonNullable<DriftEntry['rules']> {
    return paths.flatMap((path) => {
        const old = rulesAt(previous, path);
        const next = rulesAt(proposed, path);
        const added = [...next.keys()].filter((rule) => !old.has(rule)).toSorted();
        const removed = [...old.keys()].filter((rule) => !next.has(rule)).toSorted();
        const changed = [...next.keys()]
            .filter((rule) => old.has(rule) && !isDeepStrictEqual(old.get(rule), next.get(rule)))
            .toSorted();
        return added.length + removed.length + changed.length === 0 ? [] : [{ path, added, removed, changed }];
    });
}

/** Compare declared rule lists and tables as data, retaining malformed-file diagnostics beside the byte diff. */
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
