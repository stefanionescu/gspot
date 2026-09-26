import { posix } from 'node:path';
import type { TomlTable } from '#cli/types/repository/repository.ts';
import { shellcheckRules } from '#cli/repository/configuration/shellcheck-rules.ts';
import { asRaw, asStrings, asText } from '#cli/policy/adoption/source.ts';
import { appendSetting, carriedTool, reasonFor } from '#cli/policy/adoption/results.ts';
import type { CarriedConfiguration, CarryPush, CarrySource } from '#cli/types/policy/adoption.ts';

function pushCodes(push: CarryPush, codes: string): void {
    for (const code of codes.split(',')) if (code.trim() !== '') push(code.trim());
}

const DISABLED_READERS: Record<string, (source: CarrySource, push: CarryPush, path: string) => void> = {
    shellcheck: (source, push) => {
        for (const code of shellcheckRules(source.text).disable) push(code);
    },
    sqlfluff: (source, push) => {
        const codes = asText(asRaw(source.parsed['sqlfluff'])?.['exclude_rules']);
        if (codes !== undefined) pushCodes(push, codes);
    },
    squawk: (source, push) => {
        disabledFromList(source.parsed, 'excluded_rules', push);
    },
    swiftlint: (source, push) => {
        disabledFromList(source.parsed, 'disabled_rules', push);
    },
    hadolint: (source, push) => {
        disabledFromList(source.parsed, 'ignored', push);
    },
};

/**
 * The value of a `key = value` line.
 * @param line one line of an authored file
 * @param key the key the line must start with
 * @returns the value, or undefined when the line is not that assignment
 */
export function valueOfKeyLine(line: string, key: string): string | undefined {
    const trimmed = line.trim();
    if (!trimmed.startsWith(key)) return undefined;
    const rest = trimmed.slice(key.length).trimStart();
    return rest.startsWith('=') ? rest.slice(1).trim() : undefined;
}

/**
 * Carries every rule named in a list key of a parsed file.
 * @param parsed the parsed file
 * @param key the key that holds the disabled rules
 * @param push receives each rule
 */
export function disabledFromList(parsed: TomlTable, key: string, push: CarryPush): void {
    const rules = asStrings(parsed[key]);
    for (const rule of rules) push(rule);
}

/**
 * Carries the rules an authored tool configuration disables as ignores of the tool's check.
 * @param source the authored file, read and parsed
 * @param tool the tool name
 * @param path the authored file's path
 * @param lists the carried configuration
 * @param check the check the ignores belong to
 */
export function carryDisabled(
    source: CarrySource,
    tool: string,
    path: string,
    lists: CarriedConfiguration,
    check: string | undefined,
): void {
    const reader = DISABLED_READERS[tool];
    if (check === undefined || reader === undefined)
        throw new Error(`No complete ${tool} configuration importer is available for ${path}.`);
    const push: CarryPush = (rule, paths) => {
        const base = posix.dirname(path);
        const selected = paths ?? (base === '.' ? undefined : [`${base}/**`]);
        carriedTool(lists, tool).ignores.push({
            check,
            rule,
            reason: reasonFor(path),
            ...(selected ? { paths: selected } : {}),
        });
    };
    reader(source, push, path);
}

/**
 * Carries a root Pyright exclude list as a basedpyright setting.
 * @param source the authored file, read and parsed
 * @param path the authored file's path
 * @param lists the carried configuration
 */
export function carryPyright(source: CarrySource, path: string, lists: CarriedConfiguration): void {
    if (path.includes('/')) throw new Error(`Scoped Pyright configuration ${path} requires explicit conversion.`);
    const parsed = source.parsed;
    const kept = asStrings(parsed['exclude']);
    if (kept.length > 0) appendSetting(lists, 'basedpyright', 'exclude', [{ paths: kept, reason: reasonFor(path) }]);
}
