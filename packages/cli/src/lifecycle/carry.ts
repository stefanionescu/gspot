import { openConfinedRoot } from '#cli/lifecycle/confined.ts';
// The carry readers of takeover: the exception lists and disabled rules that old configuration files hold.
import { extname } from 'node:path';
import { z } from 'zod';
import { parse as parseYaml } from 'yaml';
import { parse as parseToml } from 'smol-toml';
import type { TomlTable } from '#cli/policy/types.ts';
import { CARRIED_REASON } from '#cli/policy/reasons-definitions.ts';
import { parseJsonc } from '#cli/repository/jsonc.ts';
import { ignoreFileEntries } from '#cli/lifecycle/ignore-files.ts';
import { CHECK_BY_TOOL } from '#cli/lifecycle/carry-definitions.ts';
import type { CarryPush, CarriedLists, CarrySource, FileSnapshot } from '#cli/lifecycle/types.ts';

const DATE_LENGTH = 10;
const COMMENT_MARK = /^(?:#|\/\/)\s?/u;

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

const STRUCTURED_PARSERS: Record<string, (text: string) => unknown> = {
    '.toml': parseToml,
    '.yaml': parseYaml,
    '.yml': parseYaml,
    '.json': (text) => JSON.parse(text) as unknown,
    '.jsonc': parseJsonc,
};

function parseSource(tool: string, path: string, text: string): unknown {
    // EditorConfig is resolved through Prettier and retained, never retired as a parsed settings table.
    if (tool === 'editorconfig') return {};
    if (path.endsWith('.json5'))
        throw new Error('JSON5 configuration requires tool-specific evaluation and must remain active.');
    if (tool === 'eslint' || /\.[cm]?[jt]s$/u.test(path))
        throw new Error('This configuration requires tool-specific evaluation.');
    if (tool === 'licenses') return JSON.parse(text) as unknown;
    if (tool === 'pyright') return parseJsonc(text);
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
    const kept = excludes;
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

function disabledRuff(parsed: TomlTable, push: CarryPush): void {
    const lint = asRaw(asRaw(asRaw(parsed['tool'])?.['ruff'])?.['lint']) ?? asRaw(parsed['lint']) ?? parsed;
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
    if (check === undefined || reader === undefined)
        throw new Error(`No complete ${tool} configuration importer is available for ${path}.`);
    const push: CarryPush = (rule, paths) => {
        lists.ignores.push({ check, rule, reason: reasonFor(path), ...(paths ? { paths } : {}) });
    };
    reader(source, push);
}

function carryPyright(source: CarrySource, path: string, lists: CarriedLists): void {
    if (path.includes('/')) throw new Error(`Scoped Pyright configuration ${path} requires explicit conversion.`);
    const parsed = source.parsed;
    const kept = asStrings(parsed['exclude']);
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

/** Capture original UTF-8 configuration bytes and permissions through the confined reader. */
export function observeConfiguration(root: string, path: string): Omit<CarrySource, 'parsed'> {
    const files = openConfinedRoot(root);
    try {
        const original = files.read(path);
        if (original === undefined) throw new Error('Configuration disappeared before it could be read.');
        const text = original.bytes.toString('utf8');
        if (!Buffer.from(text).equals(original.bytes)) throw new Error('Configuration must be UTF-8 text.');
        return { text, original };
    } finally {
        files.close();
    }
}

/** Parse static settings from the same bytes used for mutation authorization. */
export function parseCarrySource(original: FileSnapshot, tool: string, path: string): CarrySource {
    const source = { original, text: original.bytes.toString('utf8') };
    const parsed = asRaw(parseSource(tool, path, source.text));
    if (parsed === undefined) throw new Error('Configuration must contain a settings table.');
    return { ...source, parsed };
}

/**
 * Reads what one old configuration file holds that gspot keeps: exception lists for the four list tools, disabled rules for the rest.
 * @param source the input already read and parsed
 * @param tool the tool the file configures
 * @param path the file, relative to the root
 * @param lists the lists the entries are added to
 */
export function carryFrom(source: CarrySource, tool: string, path: string, lists: CarriedLists): void {
    const strings = z.array(z.string());
    const disabled = z.record(z.string(), z.union([z.literal(false), z.null()]));
    const lint = z.strictObject({
        ignore: strings.optional(),
        'per-file-ignores': z.record(z.string(), strings).optional(),
    });
    const allowlist = z.strictObject({
        description: z.string().optional(),
        paths: strings.optional(),
        regexes: strings.optional(),
        regexTarget: z.string().optional(),
        condition: z.string().optional(),
    });
    const schemas: Record<string, z.ZodType> = {
        typos: z.strictObject({
            default: z
                .strictObject({
                    locale: z.string().optional(),
                    'extend-words': z
                        .record(z.string(), z.string())
                        .refine(
                            (words) => Object.entries(words).every(([word, replacement]) => word === replacement),
                            'Spelling replacements require explicit conversion.',
                        )
                        .optional(),
                })
                .optional(),
            files: z.strictObject({ 'extend-exclude': strings.optional() }).optional(),
        }),
        gitleaks: z.strictObject({
            allowlist: allowlist.optional(),
            allowlists: z.array(allowlist).optional(),
            extend: z.strictObject({ useDefault: z.literal(true) }).optional(),
        }),
        osv: z.strictObject({
            IgnoredVulns: z
                .array(
                    z.strictObject({
                        id: z.string(),
                        reason: z.string().optional(),
                        ignoreUntil: z.union([z.string(), z.date()]).optional(),
                    }),
                )
                .optional(),
        }),
        pyright: z.strictObject({ exclude: strings.optional() }),
        licenses: z.strictObject({
            excludePackages: z.union([z.string(), strings]).optional(),
            onlyAllow: z.union([z.string(), strings]).optional(),
        }),
        ruff: z.union([lint, z.strictObject({ lint })]),
        markdownlint: z.union([disabled, z.strictObject({ config: disabled })]),
        stylelint: z.strictObject({ rules: disabled }),
        squawk: z.strictObject({ excluded_rules: strings.optional() }),
        swiftlint: z.strictObject({ disabled_rules: strings.optional() }),
        hadolint: z.strictObject({ ignored: strings.optional() }),
    };
    if (tool === 'shellcheck' || tool === 'sqlfluff') {
        const key = tool === 'shellcheck' ? 'disable' : 'exclude_rules';
        const unsupported = source.text.split('\n').find((line) => {
            const content = line.trim();
            return (
                content !== '' &&
                !content.startsWith('#') &&
                !(tool === 'sqlfluff' && content === '[sqlfluff]') &&
                valueOfKeyLine(line, key) === undefined
            );
        });
        if (unsupported !== undefined)
            throw new Error(`${path}: unsupported configuration line ${JSON.stringify(unsupported)}.`);
    } else if (tool !== 'sqlfluffignore' && tool !== 'semgrepignore') {
        const schema = schemas[tool];
        if (schema === undefined) throw new Error(`${path}: no complete ${tool} configuration importer is available.`);
        const parsed = schema.safeParse(source.parsed);
        if (!parsed.success)
            throw new Error(
                `${path}: unsupported settings: ${parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`,
            );
    }
    const carrier = CARRIERS[tool];
    if (carrier) carrier(source, path, lists);
    else carryDisabled(source, tool, path, lists);
}
