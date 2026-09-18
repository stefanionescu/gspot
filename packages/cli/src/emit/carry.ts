// The carry readers of takeover: the exception lists and disabled rules that old configuration files hold.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import type { Raw } from '#types/config.ts';
import { parse as parseToml } from 'smol-toml';
import { parse as parseJsonc } from 'jsonc-parser';
import { CARRIED_REASON } from '#config/reasons.ts';
import type { CarryPush, CarriedLists } from '#types/emit.ts';

const CHECK_BY_TOOL: Record<string, string> = {
    shellcheck: 'bash/shellcheck',
    sqlfluff: 'sql/sqlfluff',
    squawk: 'postgres/squawk',
    swiftlint: 'swift/swiftlint',
    markdownlint: 'markdown/markdownlint',
    stylelint: 'css/stylelint',
    eslint: 'typescript/eslint',
    ruff: 'python/ruff',
    hadolint: 'docker/hadolint',
    typos: 'spelling/typos',
    gitleaks: 'secrets/gitleaks',
    osv: 'dependencies/osv',
    licenses: 'licenses/npm',
};

const DATE_LENGTH = 10;
const TYPOS_DEFAULT_EXCLUDES = [
    'node_modules',
    'dist',
    'build',
    'coverage',
    '.lock',
    'DerivedData',
    'Pods',
    '.build',
    '*.png',
    '*.jpg',
    '*.jpeg',
    '*.gif',
    '*.svg',
    '*.mp3',
    '*.mp4',
    '*.ttf',
    '*.woff',
    '*.woff2',
    '*.ico',
    '*.zip',
    '*.pdf',
];
const COMMENT_MARK = /^(?:#|\/\/)\s?/u;
const OFF_WORDS = ["'off'", '"off"', "['off'", '["off"', "[ 'off'", '[ "off"'];

function reasonFor(file: string): string {
    return CARRIED_REASON.replaceAll('{{file}}', () => file);
}

function readText(root: string, path: string): string {
    try {
        return readFileSync(join(root, path), 'utf8');
    } catch {
        return '';
    }
}

function asRaw(value: unknown): Raw | undefined {
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Raw) : undefined;
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

function tryParseToml(text: string): Raw | undefined {
    try {
        return parseToml(text);
    } catch {
        return undefined;
    }
}

function tryParseYaml(text: string): Raw | undefined {
    try {
        return asRaw(parseYaml(text));
    } catch {
        return undefined;
    }
}

function tryParseJson(text: string): Raw | undefined {
    try {
        return asRaw(JSON.parse(text));
    } catch {
        return undefined;
    }
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

function carryTyposWords(lines: string[], words: Raw, path: string, lists: CarriedLists): void {
    for (const word of Object.keys(words)) {
        const index = lines.findIndex((line) => isKeyLine(line, word));
        const comment = index === -1 ? undefined : commentAbove(lines, index);
        lists.typosWords.push({ word, reason: comment ?? reasonFor(path) });
    }
}

function carryTypos(root: string, path: string, lists: CarriedLists): void {
    const text = readText(root, path);
    const parsed = tryParseToml(text);
    if (!parsed) return;
    carryTyposWords(text.split('\n'), asRaw(asRaw(parsed['default'])?.['extend-words']) ?? {}, path, lists);
    const excludes = asStrings(asRaw(parsed['files'])?.['extend-exclude']);
    const kept = excludes.filter((pattern) => !isDefaultExclude(pattern));
    if (kept.length === 0) return;
    lists.typosExcludes.push({
        paths: kept.map((pattern) => (pattern.endsWith('/') ? `${pattern}**` : pattern)),
        reason: reasonFor(path),
    });
}

function carryGitleaks(root: string, path: string, lists: CarriedLists): void {
    const parsed = tryParseToml(readText(root, path));
    if (!parsed) return;
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
            reason: description === '' ? reasonFor(path) : description,
        });
    }
}

function reviewBy(value: unknown): string | undefined {
    const text = asText(value) ?? (value instanceof Date ? value.toISOString() : undefined);
    return text?.slice(0, DATE_LENGTH);
}

function carryOsv(root: string, path: string, lists: CarriedLists): void {
    const parsed = tryParseToml(readText(root, path));
    if (!parsed) return;
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

function carryLicenses(root: string, path: string, lists: CarriedLists): void {
    const parsed = tryParseJson(readText(root, path));
    if (!parsed) return;
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

function disabledFromList(parsed: Raw | undefined, key: string, push: CarryPush): void {
    const rules = asStrings(parsed?.[key]);
    for (const rule of rules) push(rule);
}

function parseByExtension(path: string, text: string): Raw | undefined {
    const isYaml = path.endsWith('.yaml') || path.endsWith('.yml');
    return isYaml ? tryParseYaml(text) : asRaw(parseJsonc(text));
}

function disabledFromRulesTable(tool: string, path: string, text: string, push: CarryPush): void {
    const parsed = parseByExtension(path, text);
    if (!parsed) return;
    const table = tool === 'markdownlint' ? (asRaw(parsed['config']) ?? parsed) : (asRaw(parsed['rules']) ?? {});
    const rules = Object.entries(table);
    for (const [rule, value] of rules) if (value === false || value === null) push(rule);
}

function unquoted(text: string): string {
    const trimmed = text.trim();
    const isQuoted =
        (trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'));
    return isQuoted ? trimmed.slice(1, -1) : trimmed;
}

function isOffValue(value: string): boolean {
    if (OFF_WORDS.some((off) => value.startsWith(off))) return true;
    return value === '0' || value.startsWith('0,');
}

function disabledEslint(text: string, push: CarryPush): void {
    for (const line of text.split('\n')) {
        const colon = line.indexOf(':');
        if (colon === -1) continue;
        const rule = unquoted(line.slice(0, colon));
        if (rule === '' || (!rule.includes('/') && !/^[a-z][a-z0-9-]*$/u.test(rule))) continue;
        if (isOffValue(line.slice(colon + 1).trim())) push(rule);
    }
}

function ruffLintTable(parsed: Raw): Raw {
    return asRaw(asRaw(asRaw(parsed['tool'])?.['ruff'])?.['lint']) ?? asRaw(parsed['lint']) ?? parsed;
}

function disabledRuff(text: string, push: CarryPush): void {
    const parsed = tryParseToml(text);
    if (!parsed) return;
    const lint = ruffLintTable(parsed);
    disabledFromList(lint, 'ignore', push);
    const perFile = Object.entries(asRaw(lint['per-file-ignores']) ?? {});
    for (const [glob, codes] of perFile) for (const code of asStrings(codes)) push(code, [glob]);
}

const DISABLED_READERS: Record<string, (text: string, path: string, push: CarryPush) => void> = {
    shellcheck: (text, _path, push) => {
        disabledShellcheck(text, push);
    },
    sqlfluff: (text, _path, push) => {
        disabledSqlfluff(text, push);
    },
    squawk: (text, _path, push) => {
        disabledFromList(tryParseToml(text), 'excluded_rules', push);
    },
    swiftlint: (text, _path, push) => {
        disabledFromList(tryParseYaml(text), 'disabled_rules', push);
    },
    hadolint: (text, _path, push) => {
        disabledFromList(tryParseYaml(text), 'ignored', push);
    },
    markdownlint: (text, path, push) => {
        disabledFromRulesTable('markdownlint', path, text, push);
    },
    stylelint: (text, path, push) => {
        disabledFromRulesTable('stylelint', path, text, push);
    },
    eslint: (text, _path, push) => {
        disabledEslint(text, push);
    },
    ruff: (text, _path, push) => {
        disabledRuff(text, push);
    },
};

function carryDisabled(root: string, tool: string, path: string, lists: CarriedLists): void {
    const check = CHECK_BY_TOOL[tool];
    const reader = DISABLED_READERS[tool];
    if (check === undefined || reader === undefined) return;
    const push: CarryPush = (rule, paths) => {
        lists.ignores.push({ check, rule, reason: reasonFor(path), ...(paths ? { paths } : {}) });
    };
    reader(readText(root, path), path, push);
}

const CARRIERS: Record<string, (root: string, path: string, lists: CarriedLists) => void> = {
    typos: carryTypos,
    gitleaks: carryGitleaks,
    osv: carryOsv,
    licenses: carryLicenses,
};

/**
 * Reads what one old configuration file holds that gspot keeps: exception lists for the four list tools, disabled rules for the rest.
 * @param root the repository root
 * @param tool the tool the file configures
 * @param path the file, relative to the root
 * @param lists the lists the entries are added to
 */
export function carryFrom(root: string, tool: string, path: string, lists: CarriedLists): void {
    const carrier = CARRIERS[tool];
    if (carrier) carrier(root, path, lists);
    else carryDisabled(root, tool, path, lists);
}
