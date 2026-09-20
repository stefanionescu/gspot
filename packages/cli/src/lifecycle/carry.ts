import { readFileSync } from 'node:fs';
// The carry readers of takeover: the exception lists and disabled rules that old configuration files hold.
import { extname, join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { parse as parseToml } from 'smol-toml';
import type { TomlTable } from '#types/config.ts';
import { CARRIED_REASON } from '#config/reasons.ts';
import { ignoreFileEntries } from '#cli/lifecycle/ignore-files.ts';
import { parse as parseJsonc, type ParseError } from 'jsonc-parser';
import { CHECK_BY_TOOL, TYPOS_DEFAULT_EXCLUDES } from '#config/carry.ts';
import type { CarryPush, CarriedLists, CarrySource } from '#types/lifecycle.ts';

const DATE_LENGTH = 10;
const COMMENT_MARK = /^(?:#|\/\/)\s?/u;
const PYRIGHT_DEFAULT_EXCLUDES = new Set(['__pycache__', 'node_modules', 'build', 'dist']);

function reasonFor(file: string): string {
    return CARRIED_REASON.replaceAll('{{file}}', () => file);
}

function asRaw(value: unknown): TomlTable | undefined {
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as TomlTable) : undefined;
}

function asList(value: unknown): unknown[] {
    return Array.isArray(value) ? (value as unknown[]) : [];
}

function asStrings(value: unknown): string[] {
    return Array.isArray(value) ? value.map(String) : [];
}

function asText(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
}

function parseJsoncTable(text: string): unknown {
    const errors: ParseError[] = [];
    const parsed: unknown = parseJsonc(text, errors, { allowTrailingComma: true });
    if (errors.length > 0) throw new Error(`Invalid JSON configuration at offset ${String(errors[0]?.offset)}.`);
    return parsed;
}

const STRUCTURED_PARSERS: Record<string, (text: string) => unknown> = {
    '.toml': (text) => parseToml(text),
    '.yaml': (text) => parseYaml(text) as unknown,
    '.yml': (text) => parseYaml(text) as unknown,
    '.json': (text) => JSON.parse(text) as unknown,
    '.jsonc': parseJsoncTable,
};

function parseSource(tool: string, path: string, text: string): unknown {
    if (tool === 'eslint' || /\.[cm]?[jt]s$/u.test(path))
        throw new Error('This configuration requires tool-specific evaluation.');
    if (tool === 'licenses') return JSON.parse(text) as unknown;
    if (tool === 'pyright') return parseJsoncTable(text);
    const parse = STRUCTURED_PARSERS[extname(path)];
    if (parse !== undefined) return parse(text);
    if (['prettier', 'markdownlint', 'stylelint', 'yamllint'].includes(tool)) return parseYaml(text) as unknown;
    return {};
}

function commentAbove(lines: string[], index: number): string | undefined {
    const above: string[] = [];
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
        const line = lines[cursor]?.trim() ?? '';
        if (!line.startsWith('#') && !line.startsWith('//')) break;
        above.unshift(line.replace(COMMENT_MARK, ''));
    }
    const text = above.join(' ').trim();
    return text === '' ? undefined : text;
}

function isKeyLine(line: string, key: string): boolean {
    const trimmed = line.trim();
    const bare = trimmed.startsWith('"') ? trimmed.slice(1) : trimmed;
    if (!bare.startsWith(key)) return false;
    const after = bare.slice(key.length).trimStart();
    return after.startsWith('"') ? after.slice(1).trimStart().startsWith('=') : after.startsWith('=');
}

function isDefaultExclude(pattern: string): boolean {
    return TYPOS_DEFAULT_EXCLUDES.some((known) => pattern.includes(known));
}

function carryTyposWords(lines: string[], words: TomlTable, path: string, lists: CarriedLists): void {
    for (const word of Object.keys(words)) {
        const index = lines.findIndex((line) => isKeyLine(line, word));
        const comment = index === -1 ? undefined : commentAbove(lines, index);
        lists.typosWords.push({ word, reason: comment ?? reasonFor(path) });
    }
}

function carryTypos(source: CarrySource, path: string, lists: CarriedLists): void {
    const text = source.text;
    const parsed = source.parsed;
    const defaults = asRaw(parsed['default']);
    // typos with no locale accepts British and American spellings alike, and the repository was written under that.
    lists.typosLocale = asText(defaults?.['locale']) ?? 'en';
    carryTyposWords(text.split('\n'), asRaw(defaults?.['extend-words']) ?? {}, path, lists);
    const excludes = asStrings(asRaw(parsed['files'])?.['extend-exclude']);
    const kept = excludes.filter((pattern) => !isDefaultExclude(pattern));
    if (kept.length === 0) return;
    lists.typosExcludes.push({
        paths: kept.map((pattern) => (pattern.endsWith('/') ? `${pattern}**` : pattern)),
        reason: reasonFor(path),
    });
}

// How an allowlist regex is applied travels with it: against the line, the match or the secret, and whether every part must hold.
function targetKeys(entry: TomlTable): { regex_target?: string; condition?: string } {
    const target = asText(entry['regexTarget']);
    const condition = asText(entry['condition']);
    return {
        ...(target === undefined ? {} : { regex_target: target }),
        ...(condition === undefined ? {} : { condition }),
    };
}

function carryGitleaks(source: CarrySource, path: string, lists: CarriedLists): void {
    const parsed = source.parsed;
    const single = asRaw(parsed['allowlist']);
    const entries = [...(single ? [single] : []), ...asList(parsed['allowlists'])];
    for (const value of entries) {
        const entry = asRaw(value);
        if (!entry) continue;
        const description = asText(entry['description']) ?? '';
        lists.gitleaksAllow.push({
            description,
            paths: asStrings(entry['paths']),
            regexes: asStrings(entry['regexes']),
            ...targetKeys(entry),
            reason: description === '' ? reasonFor(path) : description,
        });
    }
}

function reviewBy(value: unknown): string | undefined {
    const text = asText(value) ?? (value instanceof Date ? value.toISOString() : undefined);
    return text?.slice(0, DATE_LENGTH);
}

function carryOsv(source: CarrySource, path: string, lists: CarriedLists): void {
    const parsed = source.parsed;
    const entries = asList(parsed['IgnoredVulns']);
    for (const value of entries) {
        const entry = asRaw(value);
        if (!entry) continue;
        const until = reviewBy(entry['ignoreUntil']);
        lists.osvIgnores.push({
            id: String(entry['id']),
            reason: asText(entry['reason']) ?? reasonFor(path),
            ...(until === undefined ? {} : { review_by: until }),
        });
    }
}

function namesOf(value: unknown): string[] {
    const items = typeof value === 'string' ? value.split(';') : asStrings(value);
    return items.map((item) => item.trim()).filter((item) => item !== '');
}

function carryLicenses(source: CarrySource, path: string, lists: CarriedLists): void {
    const parsed = source.parsed;
    const excluded = namesOf(parsed['excludePackages']);
    for (const name of excluded)
        lists.licenseExceptions.push({ package: name, license: 'UNKNOWN', reason: reasonFor(path) });
    lists.licenseAllow.push(...namesOf(parsed['onlyAllow']));
}

function pushCodes(push: CarryPush, codes: string): void {
    for (const code of codes.split(',')) if (code.trim() !== '') push(code.trim());
}

function valueOfKeyLine(line: string, key: string): string | undefined {
    const trimmed = line.trim();
    if (!trimmed.startsWith(key)) return undefined;
    const rest = trimmed.slice(key.length).trimStart();
    return rest.startsWith('=') ? rest.slice(1).trim() : undefined;
}

function disabledShellcheck(text: string, push: CarryPush): void {
    for (const line of text.split('\n')) {
        const codes = valueOfKeyLine(line, 'disable');
        if (codes !== undefined) pushCodes(push, codes);
    }
}

function disabledSqlfluff(text: string, push: CarryPush): void {
    for (const line of text.split('\n')) {
        const codes = valueOfKeyLine(line, 'exclude_rules');
        if (codes !== undefined) pushCodes(push, codes);
    }
}

function disabledFromList(parsed: TomlTable, key: string, push: CarryPush): void {
    const rules = asStrings(parsed[key]);
    for (const rule of rules) push(rule);
}

function disabledFromRulesTable(tool: string, parsed: TomlTable, push: CarryPush): void {
    const table = tool === 'markdownlint' ? (asRaw(parsed['config']) ?? parsed) : (asRaw(parsed['rules']) ?? {});
    for (const [rule, value] of Object.entries(table)) if (value === false || value === null) push(rule);
}

function ruffLintTable(parsed: TomlTable): TomlTable {
    return asRaw(asRaw(asRaw(parsed['tool'])?.['ruff'])?.['lint']) ?? asRaw(parsed['lint']) ?? parsed;
}

function disabledRuff(parsed: TomlTable, push: CarryPush): void {
    const lint = ruffLintTable(parsed);
    disabledFromList(lint, 'ignore', push);
    const perFile = Object.entries(asRaw(lint['per-file-ignores']) ?? {});
    for (const [glob, codes] of perFile) for (const code of asStrings(codes)) push(code, [glob]);
}

const DISABLED_READERS: Record<string, (source: CarrySource, push: CarryPush) => void> = {
    shellcheck: (source, push) => {
        disabledShellcheck(source.text, push);
    },
    sqlfluff: (source, push) => {
        disabledSqlfluff(source.text, push);
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
    markdownlint: (source, push) => {
        disabledFromRulesTable('markdownlint', source.parsed, push);
    },
    stylelint: (source, push) => {
        disabledFromRulesTable('stylelint', source.parsed, push);
    },
    ruff: (source, push) => {
        disabledRuff(source.parsed, push);
    },
};

function carryDisabled(source: CarrySource, tool: string, path: string, lists: CarriedLists): void {
    const check = CHECK_BY_TOOL[tool];
    const reader = DISABLED_READERS[tool];
    if (check === undefined || reader === undefined) return;
    const push: CarryPush = (rule, paths) => {
        lists.ignores.push({ check, rule, reason: reasonFor(path), ...(paths ? { paths } : {}) });
    };
    reader(source, push);
}

// The folders the preset leaves out on its own, and dot folders, which hold caches and environments git does not track.
function isShippedExclude(entry: string): boolean {
    const last = entry.split('/').at(-1) ?? entry;
    return last.startsWith('.') || PYRIGHT_DEFAULT_EXCLUDES.has(last);
}

// Only a file at the root is carried: its paths start at the root, which is where tools.basedpyright.exclude starts.
function carryPyright(source: CarrySource, path: string, lists: CarriedLists): void {
    if (path.includes('/')) return;
    const parsed = source.parsed;
    const kept = asStrings(parsed['exclude']).filter((entry) => !isShippedExclude(entry));
    if (kept.length > 0) lists.pyrightExcludes.push({ paths: kept, reason: reasonFor(path) });
}

const CARRIERS: Record<string, (source: CarrySource, path: string, lists: CarriedLists) => void> = {
    typos: carryTypos,
    gitleaks: carryGitleaks,
    osv: carryOsv,
    pyright: carryPyright,
    licenses: carryLicenses,
    sqlfluffignore: (source, path, lists) => {
        lists.sqlfluffExcludes.push(...ignoreFileEntries(source.text, path));
    },
    semgrepignore: (source, path, lists) => {
        lists.semgrepIgnores.push(...ignoreFileEntries(source.text, path));
    },
};

/**
 * Reads and parses takeover input once; failed observations and unsupported executable formats raise errors.
 * @param root the repository root
 * @param tool the tool the file configures
 * @param path the file, relative to the root
 * @returns the original text and parsed table
 */
export function readCarrySource(root: string, tool: string, path: string): CarrySource {
    const text = readFileSync(join(root, path), 'utf8');
    const value = parseSource(tool, path, text);
    const parsed = asRaw(value);
    if (parsed === undefined) throw new Error('Configuration must contain a settings table.');
    return { text, parsed };
}

/**
 * Reads what one old configuration file holds that gspot keeps: exception lists for the four list tools, disabled rules for the rest.
 * @param source the input already read and parsed
 * @param tool the tool the file configures
 * @param path the file, relative to the root
 * @param lists the lists the entries are added to
 */
export function carryFrom(source: CarrySource, tool: string, path: string, lists: CarriedLists): void {
    const carrier = CARRIERS[tool];
    if (carrier) carrier(source, path, lists);
    else carryDisabled(source, tool, path, lists);
}
