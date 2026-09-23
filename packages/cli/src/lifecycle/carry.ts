import type { ExistingTool } from '#cli/repository/types.ts';
import { evaluateConfiguration } from '#cli/lifecycle/configuration.ts';
import { licenseResponse } from '#cli/lifecycle/license-evaluation.ts';
import { stylelintRequest, stylelintResponse, stylelintSource } from '#cli/lifecycle/stylelint-evaluation.ts';
import { presetManifests } from '#cli/presets/read-manifests.ts';
import { toolPin } from '#cli/platform/tool-probe.ts';
import { configurationSection } from '#cli/repository/configuration-section.ts';
import { openConfinedRoot } from '#cli/lifecycle/confined.ts';
// The carry readers of takeover: the exception lists and disabled rules that old configuration files hold.
import { extname, posix } from 'node:path';
import { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import JSON5 from 'json5';
import parseLicense from 'spdx-expression-parse';
import { parse as parseYaml } from 'yaml';
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';
import type { TomlTable } from '#cli/policy/types.ts';
import { CARRIED_REASON } from '#cli/policy/reasons-definitions.ts';
import { parseJsonc } from '#cli/repository/jsonc.ts';
import { ignoreFileEntries } from '#cli/lifecycle/ignore-files.ts';
import { shellcheckRules } from '#cli/repository/shellcheck-rules.ts';
import { sqlfluffConfiguration } from '#cli/repository/sqlfluff.ts';
import { policySchema } from '#cli/policy/schema.ts';
import type {
    CarriedIgnore,
    CarryPush,
    CarriedConfiguration,
    CarrySource,
    FileSnapshot,
} from '#cli/lifecycle/types.ts';

const COMMENT_MARK = /^(?:#|\/\/)\s?/u;

const RUFF_LINT = z.strictObject({
    ignore: z.array(z.string()).optional(),
    'extend-ignore': z.array(z.string()).optional(),
    'per-file-ignores': z.record(z.string(), z.array(z.string())).optional(),
    'extend-per-file-ignores': z.record(z.string(), z.array(z.string())).optional(),
});

const RUFF_SOURCE = z.union([
    RUFF_LINT.extend({ extend: z.string().min(1).optional() }),
    z.strictObject({ lint: RUFF_LINT, extend: z.string().min(1).optional() }),
]);

const MARKDOWN_SOURCE = z
    .object({ extends: z.string().min(1).optional() })
    .catchall(z.union([z.boolean(), z.record(z.string(), z.json())]))
    .refine(
        (source) =>
            Object.keys(source).every(
                (key) => key === 'extends' || /^(?:default|MD\d{3}|[a-z]+(?:-[a-z]+)+)$/u.test(key),
            ),
        'Use Markdown rule names or a static inheritance path.',
    );

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
    '.json5': (text) => JSON5.parse(text) as unknown,
};

function parseSource(tool: string, path: string, text: string): unknown {
    if (tool === 'sqlfluff' && posix.basename(path) !== '.sqlfluffignore')
        return Object.fromEntries(
            [...sqlfluffConfiguration(text)].map(([section, values]) => [section, Object.fromEntries(values)]),
        );
    // EditorConfig is resolved through Prettier and retained, never retired as a parsed settings table.
    if (tool === 'ec') return {};
    if (tool === 'eslint' || /\.[cm]?[jt]s$/u.test(path))
        throw new Error('This configuration requires tool-specific evaluation.');
    if (tool === 'basedpyright') return parseJsonc(text);
    const parse = STRUCTURED_PARSERS[extname(path)];
    if (parse !== undefined) return parse(text);
    if (['prettier', 'markdownlint-cli2', 'stylelint', 'yamllint'].includes(tool)) return parseYaml(text) as unknown;
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

function carryTyposWords(lines: string[], words: TomlTable, path: string): { word: string; reason: string }[] {
    return Object.keys(words).map((word) => {
        const index = lines.findIndex((line) => isKeyLine(line, word));
        const comment = index === -1 ? undefined : commentAbove(lines, index);
        return { word, reason: comment ?? reasonFor(path) };
    });
}

function carryTypos(source: CarrySource, path: string, lists: CarriedConfiguration): void {
    const text = source.text;
    const parsed = source.parsed;
    const defaults = asRaw(parsed['default']);
    // typos with no locale accepts British and American spellings alike, and the repository was written under that.
    const settings: TomlTable = { locale: asText(defaults?.['locale']) ?? 'en' };
    const words = carryTyposWords(text.split('\n'), asRaw(defaults?.['extend-words']) ?? {}, path);
    if (words.length > 0) settings['words'] = words;
    const excludes = asStrings(asRaw(parsed['files'])?.['extend-exclude']);
    const base = posix.dirname(path);
    const paths = excludes
        .filter((pattern) => pattern !== '' && !pattern.startsWith('#'))
        .map((pattern) => {
            if (base === '.') return pattern;
            const negated = pattern.startsWith('!');
            const bare = negated ? pattern.slice(1) : pattern;
            const directory = bare.endsWith('/');
            const selector = directory ? bare.slice(0, -1) : bare;
            const rooted = selector.startsWith('/') || selector.includes('/');
            const prefix = base.replaceAll(/[?*\[\]{}]/gu, '\\$&');
            return `${negated ? '!' : ''}${prefix}/${rooted ? '' : '**/'}${selector.replace(/^\//u, '')}${directory ? '/' : ''}`;
        });
    if (paths.length > 0) settings['exclude'] = [{ paths, reason: reasonFor(path) }];
    if (base === '.') Object.assign(carriedTool(lists, 'typos').settings, settings);
    else {
        const scope = lists.scopes.get(base) ?? { presets: [], tools: {} };
        scope.presets = [...new Set([...scope.presets, 'spelling'])];
        scope.tools['typos'] = settings;
        lists.scopes.set(base, scope);
    }
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

function carryGitleaks(source: CarrySource, path: string, lists: CarriedConfiguration): void {
    if (path.includes('/')) throw new Error(`${path}: scoped secret allowlists require explicit conversion.`);
    const parsed = source.parsed;
    const single = asRaw(parsed['allowlist']);
    const entries = [...(single ? [single] : []), ...asList(parsed['allowlists'])];
    for (const value of entries) {
        const entry = asRaw(value);
        if (!entry) continue;
        const description = asText(entry['description']) ?? '';
        appendSetting(lists, 'gitleaks', 'allow', [
            {
                description,
                paths: asStrings(entry['paths']),
                regexes: asStrings(entry['regexes']),
                ...targetKeys(entry),
                reason: description === '' ? reasonFor(path) : description,
            },
        ]);
    }
}

function reviewBy(value: unknown): string | undefined {
    return asText(value) ?? (value instanceof Date ? value.toISOString() : undefined);
}

function carryOsv(source: CarrySource, path: string, lists: CarriedConfiguration): void {
    if (path.includes('/'))
        throw new Error(`${path}: directory-local advisory exceptions require explicit conversion.`);
    const parsed = source.parsed;
    const entries = asList(parsed['IgnoredVulns']);
    for (const value of entries) {
        const entry = asRaw(value);
        if (!entry) continue;
        const until = reviewBy(entry['ignoreUntil']);
        appendSetting(lists, 'osv', 'ignore', [
            {
                id: String(entry['id']),
                reason: asText(entry['reason']) ?? reasonFor(path),
                ...(until === undefined ? {} : { review_by: until }),
            },
        ]);
    }
}

function namesOf(value: unknown): string[] {
    const items = typeof value === 'string' ? value.split(';') : asStrings(value);
    return items.map((item) => item.trim()).filter((item) => item !== '');
}

async function carryLicenses(
    source: CarrySource,
    path: string,
    lists: CarriedConfiguration,
    root: string,
): Promise<void> {
    const parsed = source.parsed;
    const allowed = namesOf(parsed['onlyAllow']);
    const defaults = z.array(z.string()).parse(
        presetManifests()
            .get('licenses')
            ?.settings.find((setting) => setting.name === 'tools.licenses.licenses_allowed')?.default,
    );
    if (allowed.length > 0 && defaults.some((license) => !allowed.includes(license)))
        throw new Error(
            `${path}: the license allowlist is narrower than the shipped policy and requires explicit conversion.`,
        );
    for (const license of allowed) {
        try {
            const parsed = parseLicense(license);
            if (typeof parsed !== 'object' || parsed === null || !('license' in parsed))
                throw new Error('Compound approved licenses require explicit conversion.');
        } catch (cause) {
            throw new Error(
                `${path}: license allowance ${JSON.stringify(license)} cannot be represented as one approved SPDX license.`,
                { cause },
            );
        }
    }
    const excluded = namesOf(parsed['excludePackages']);
    const settings: TomlTable = {};
    if (excluded.length > 0) {
        const entries = licenseResponse.parse(
            await evaluateConfiguration({
                root,
                from: path,
                exclusions: excluded,
                tool: 'license-checker-rseidelsohn',
                operation: 'licenses',
            }),
        );
        settings['packages_allowed'] = entries.map((entry) => ({ ...entry, reason: reasonFor(path) }));
    }
    if (allowed.length > 0) settings['licenses_allowed'] = allowed;
    const base = posix.dirname(path);
    if (base === '.') {
        for (const [key, values] of Object.entries(settings)) appendSetting(lists, 'licenses', key, asList(values));
    } else {
        const scope = lists.scopes.get(base) ?? { presets: [], tools: {} };
        scope.presets = [...new Set([...scope.presets, 'licenses'])];
        scope.tools['licenses'] = settings;
        lists.scopes.set(base, scope);
    }
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
    for (const code of shellcheckRules(text).disable) push(code);
}

function disabledFromList(parsed: TomlTable, key: string, push: CarryPush): void {
    const rules = asStrings(parsed[key]);
    for (const rule of rules) push(rule);
}

function disabledRuff(parsed: TomlTable, push: CarryPush, path: string): void {
    const lint = asRaw(asRaw(asRaw(parsed['tool'])?.['ruff'])?.['lint']) ?? asRaw(parsed['lint']) ?? parsed;
    const base = posix.dirname(path);
    const entries = ['per-file-ignores', 'extend-per-file-ignores'].flatMap((key) =>
        Object.entries(asRaw(lint[key]) ?? {}),
    );
    const perFile = entries.map(([glob, codes]) => {
        if (
            glob.startsWith('/') ||
            /[\\:]/u.test(glob) ||
            glob.split('/').includes('..') ||
            (base !== '.' && glob.startsWith('!'))
        )
            throw new Error(`${path}: per-file selector ${JSON.stringify(glob)} requires explicit conversion.`);
        const negative = glob.startsWith('!');
        const pattern = negative ? glob.slice(1) : glob;
        const relative = pattern.includes('/') ? pattern : `**/${pattern}`;
        return {
            pattern: `${negative ? '!' : ''}${base === '.' ? '' : `${base}/`}${relative}`,
            codes: asStrings(codes),
        };
    });
    disabledFromList(lint, 'ignore', push);
    disabledFromList(lint, 'extend-ignore', push);
    for (const { pattern, codes } of perFile) for (const code of codes) push(code, [pattern]);
}

const DISABLED_READERS: Record<string, (source: CarrySource, push: CarryPush, path: string) => void> = {
    shellcheck: (source, push) => {
        disabledShellcheck(source.text, push);
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
    ruff: (source, push, path) => {
        disabledRuff(source.parsed, push, path);
    },
};

function carryDisabled(
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

function carryPyright(source: CarrySource, path: string, lists: CarriedConfiguration): void {
    if (path.includes('/')) throw new Error(`Scoped Pyright configuration ${path} requires explicit conversion.`);
    const parsed = source.parsed;
    const kept = asStrings(parsed['exclude']);
    if (kept.length > 0) appendSetting(lists, 'basedpyright', 'exclude', [{ paths: kept, reason: reasonFor(path) }]);
}

function carryRuff(source: CarrySource, path: string, lists: CarriedConfiguration, root: string, check?: string): void {
    const visiting = new Set<string>();
    const inherited = new Set<string>();
    const base = posix.dirname(path);
    const scopedPatterns = (owner: string, table: Record<string, string[]> | undefined): Record<string, string[]> => {
        const result: Record<string, string[]> = {};
        for (const [pattern, rules] of Object.entries(table ?? {})) {
            if (owner === path || !pattern.includes('/')) {
                result[pattern] = rules;
                continue;
            }
            if (pattern.startsWith('!') || pattern.startsWith('/') || /[\\:]/u.test(pattern))
                throw new Error(
                    `${owner}: inherited per-file selector ${JSON.stringify(pattern)} requires explicit conversion.`,
                );
            const target = posix.normalize(posix.join(posix.dirname(owner), pattern));
            if (target === '..' || target.startsWith('../'))
                throw new Error(`${owner}: inherited per-file selector escapes the repository.`);
            if (base === '.' || target.startsWith(`${base}/`)) {
                const scoped = base === '.' ? target : target.slice(base.length + 1);
                result[scoped] = [...new Set([...(result[scoped] ?? []), ...rules])];
                continue;
            }
            const parts = target.split('/');
            const magic = parts.findIndex((part) => /[*?{[!]/u.test(part));
            const fixed = (magic === -1 ? parts : parts.slice(0, magic)).join('/');
            if (fixed !== '' && !base.startsWith(`${fixed}/`) && fixed !== base) continue;
            throw new Error(
                `${owner}: inherited per-file selector ${JSON.stringify(pattern)} requires explicit scope conversion.`,
            );
        }
        return result;
    };
    const resolve = (path: string, source: CarrySource): z.infer<typeof RUFF_LINT> => {
        if (visiting.has(path)) throw new Error(`${path}: Ruff configuration inheritance contains a cycle.`);
        visiting.add(path);
        const configuration = RUFF_SOURCE.parse(source.parsed);
        const lint = 'lint' in configuration ? configuration.lint : configuration;
        let parent: z.infer<typeof RUFF_LINT> = {};
        if (configuration.extend !== undefined) {
            const from = configuration.extend;
            if (from.startsWith('/') || /[\\:$~]/u.test(from))
                throw new Error(`${path}: inherited Ruff configuration must use a repository-relative path.`);
            const target = posix.normalize(posix.join(posix.dirname(path), from));
            const original = lists.observed.get(target) ?? observeConfiguration(root, target).original;
            lists.observed.set(target, original);
            inherited.add(target);
            parent = resolve(
                target,
                parseCarrySource(
                    original,
                    'ruff',
                    target,
                    posix.basename(target) === 'pyproject.toml' ? { table: 'tool.ruff' } : undefined,
                ),
            );
        }
        const extended: Record<string, string[]> = {};
        for (const table of [parent['extend-per-file-ignores'], scopedPatterns(path, lint['extend-per-file-ignores'])])
            for (const [pattern, rules] of Object.entries(table ?? {}))
                extended[pattern] = [...new Set([...(extended[pattern] ?? []), ...rules])];
        visiting.delete(path);
        return {
            ignore: [...(parent.ignore ?? []), ...(lint.ignore ?? []), ...(lint['extend-ignore'] ?? [])],
            'per-file-ignores':
                lint['per-file-ignores'] === undefined
                    ? (parent['per-file-ignores'] ?? {})
                    : scopedPatterns(path, lint['per-file-ignores']),
            'extend-per-file-ignores': extended,
        };
    };
    const lint = resolve(path, source);
    carryDisabled({ ...source, parsed: { lint } }, 'ruff', path, lists, check);
    for (const parent of inherited)
        lists.retained.push({
            path: parent,
            note: 'Inherited Ruff configuration retained; effective exclusions are represented in gspot configuration',
        });
}

function carryMarkdownlint(source: CarrySource, path: string, lists: CarriedConfiguration, root: string): void {
    const visiting = new Set<string>();
    const inherited = new Set<string>();
    const resolve = (path: string, input: TomlTable): TomlTable => {
        if (visiting.has(path)) throw new Error(`${path}: Markdown configuration inheritance contains a cycle.`);
        visiting.add(path);
        const { extends: parent, ...rules } = MARKDOWN_SOURCE.parse(input);
        let defaults: TomlTable = {};
        if (parent !== undefined) {
            if ((!parent.startsWith('./') && !parent.startsWith('../')) || /[\\:]/u.test(parent))
                throw new Error(`${path}: inherited Markdown configuration must use a repository-relative path.`);
            const target = posix.normalize(posix.join(posix.dirname(path), parent));
            if (!['.json', '.jsonc', '.yaml', '.yml'].includes(extname(target)))
                throw new Error(`${path}: inherited Markdown configuration requires static JSON or YAML.`);
            const original = lists.observed.get(target) ?? observeConfiguration(root, target).original;
            lists.observed.set(target, original);
            inherited.add(target);
            defaults = resolve(target, parseCarrySource(original, 'markdownlint-cli2', target).parsed);
        }
        visiting.delete(path);
        return { ...defaults, ...rules };
    };
    const rules = { default: true, ...resolve(path, asRaw(source.parsed['config']) ?? source.parsed) };
    const converted = parseToml(stringifyToml({ rules }));
    if (!isDeepStrictEqual(converted['rules'], rules))
        throw new Error(`${path}: Markdown rule options cannot be represented without loss in TOML.`);
    const base = posix.dirname(path);
    if (base === '.') carriedTool(lists, 'markdownlint').settings['rules'] = rules;
    else {
        const scope = lists.scopes.get(base) ?? { presets: [], tools: {} };
        scope.presets = [...new Set([...scope.presets, 'markdown'])];
        scope.tools['markdownlint'] = { rules };
        lists.scopes.set(base, scope);
    }
    for (const parent of inherited)
        lists.retained.push({
            path: parent,
            note: 'Inherited Markdown configuration retained; effective rules are represented in gspot configuration',
        });
}

/** Resolve static inheritance from observed files, retaining every input for publication-time validation. */
function stylelintRules(
    root: string,
    path: string,
    source: CarrySource,
    lists: CarriedConfiguration,
): z.infer<typeof stylelintRequest>['rules'] {
    const visiting = new Set<string>();
    const resolve = (path: string, source: CarrySource): z.infer<typeof stylelintRequest>['rules'] => {
        if (visiting.has(path)) throw new Error(`${path}: Stylelint configuration inheritance contains a cycle.`);
        visiting.add(path);
        const configuration = stylelintSource.parse(source.parsed);
        let rules: z.infer<typeof stylelintRequest>['rules'] = {};
        for (const parent of [configuration.extends ?? []].flat()) {
            if ((!parent.startsWith('./') && !parent.startsWith('../')) || /[\\:]/u.test(parent))
                throw new Error(`${path}: inherited Stylelint configuration must use a repository-relative path.`);
            const target = posix.normalize(posix.join(posix.dirname(path), parent));
            if (!['.json', '.yaml', '.yml'].includes(extname(target)) && posix.basename(target) !== '.stylelintrc')
                throw new Error(`${path}: inherited Stylelint configuration requires static JSON or YAML.`);
            const original = lists.observed.get(target) ?? observeConfiguration(root, target).original;
            lists.observed.set(target, original);
            rules = { ...rules, ...resolve(target, parseCarrySource(original, 'stylelint', target)) };
        }
        visiting.delete(path);
        return { ...rules, ...configuration.rules };
    };
    return resolve(path, source);
}

/** Validate the complete rule table before recording settings or authorizing retirement. */
async function carryStylelint(
    source: CarrySource,
    path: string,
    lists: CarriedConfiguration,
    root: string,
    check?: string,
): Promise<void> {
    if (check === undefined) throw new Error(`${path}: Stylelint adoption requires its declared destination check.`);
    const rules = stylelintRules(root, path, source, lists);
    const disabled = new Set(
        Object.entries(rules)
            .filter(([, value]) => (Array.isArray(value) ? value[0] : value) === null)
            .map(([rule]) => rule),
    );
    const enabled = Object.fromEntries(Object.entries(rules).filter(([rule]) => !disabled.has(rule)));
    const converted = parseToml(stringifyToml({ rules: enabled }));
    if (!isDeepStrictEqual(converted['rules'], enabled))
        throw new Error(`${path}: Stylelint rule options cannot be represented without loss in TOML.`);
    const version = z.string().min(1).parse(toolPin(presetManifests().values(), 'stylelint').version);
    stylelintResponse.parse(
        await evaluateConfiguration({ root, tool: 'stylelint', operation: 'stylelint', version, rules }),
    );
    const carried = carriedTool(lists, 'stylelint');
    const base = posix.dirname(path);
    if (base === '.') carried.settings['rules'] = enabled;
    else {
        const scope = lists.scopes.get(base) ?? { presets: [], tools: {} };
        scope.presets = [...new Set([...scope.presets, 'css'])];
        scope.tools['stylelint'] = { rules: enabled };
        lists.scopes.set(base, scope);
    }
    const paths = base === '.' ? undefined : [`${base.replaceAll(/[?*\[\]{}]/gu, '\\$&')}/**`];
    for (const rule of disabled)
        carried.ignores.push({ check, rule, reason: reasonFor(path), ...(paths === undefined ? {} : { paths }) });
}

const CARRIERS: Record<
    string,
    (
        source: CarrySource,
        path: string,
        lists: CarriedConfiguration,
        root: string,
        check?: string,
    ) => void | Promise<void>
> = {
    ruff: carryRuff,
    stylelint: carryStylelint,
    'markdownlint-cli2': carryMarkdownlint,
    typos: carryTypos,
    gitleaks: carryGitleaks,
    'osv-scanner': carryOsv,
    basedpyright: carryPyright,
    'license-checker-rseidelsohn': carryLicenses,
};

function appendSetting(lists: CarriedConfiguration, tool: string, key: string, entries: unknown[]): void {
    if (entries.length === 0) return;
    const settings = carriedTool(lists, tool).settings;
    settings[key] = [...asList(settings[key]), ...entries];
}

/** The entries owned by one adopted tool, shared by readers, policy emission, and the plan. */
export function carriedTool(
    lists: CarriedConfiguration,
    tool: string,
): { settings: TomlTable; ignores: CarriedIgnore[] } {
    const entry = lists.tools.get(tool) ?? { settings: {}, ignores: [] };
    lists.tools.set(tool, entry);
    return entry;
}

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
export function parseCarrySource(
    original: FileSnapshot,
    tool: string,
    path: string,
    selector?: { table?: string; key?: string },
): CarrySource {
    const text = original.bytes.toString('utf8');
    const selected = selector === undefined ? undefined : configurationSection(text, path, selector);
    if (selector !== undefined && selected === undefined)
        throw new Error('The selected configuration section disappeared.');
    const source = { original, text: selected?.text ?? text };
    const parsed = asRaw(
        tool === 'sqlfluff' || selected === undefined ? parseSource(tool, path, source.text) : selected.parsed,
    );
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
export async function carryFrom(
    source: CarrySource,
    tool: string,
    path: string,
    lists: CarriedConfiguration,
    root: string,
    reader: ExistingTool['carries'],
    check?: string,
): Promise<void> {
    if (reader === 'ignore-paths' && tool !== 'basedpyright') {
        const key = tool === 'sqlfluff' ? 'exclude' : tool === 'semgrep' ? 'ignore' : undefined;
        if (key === undefined) throw new Error(`${path}: no complete ${tool} ignore-path importer is available.`);
        appendSetting(lists, tool, key, ignoreFileEntries(source.text, path));
        return;
    }
    const strings = z.array(z.string());
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
                    locale: z
                        .string()
                        .refine(
                            (locale) => policySchema.safeParse({ version: 1, tools: { typos: { locale } } }).success,
                            'Use a supported typos locale.',
                        )
                        .optional(),
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
        'osv-scanner': z.strictObject({
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
        basedpyright: z.strictObject({ exclude: strings.optional() }),
        'license-checker-rseidelsohn': z.strictObject({
            excludePackages: z.union([z.string(), strings]).optional(),
            onlyAllow: z.union([z.string(), strings]).optional(),
        }),
        ruff: RUFF_SOURCE,
        'markdownlint-cli2': z.union([MARKDOWN_SOURCE, z.strictObject({ config: MARKDOWN_SOURCE })]),
        stylelint: stylelintSource,
        squawk: z.strictObject({ excluded_rules: strings.optional() }),
        swiftlint: z.strictObject({ disabled_rules: strings.optional() }),
        hadolint: z.strictObject({ ignored: strings.optional() }),
        sqlfluff: z.strictObject({ sqlfluff: z.strictObject({ exclude_rules: z.string().optional() }).optional() }),
    };
    if (tool === 'shellcheck') {
        const unsupported = source.text.split('\n').find((line) => {
            const content = line.trim();
            return content !== '' && !content.startsWith('#') && valueOfKeyLine(line, 'disable') === undefined;
        });
        if (unsupported !== undefined)
            throw new Error(`${path}: unsupported configuration line ${JSON.stringify(unsupported)}.`);
    } else {
        const schema = schemas[tool];
        if (schema === undefined) throw new Error(`${path}: no complete ${tool} configuration importer is available.`);
        const parsed = schema.safeParse(source.parsed);
        if (!parsed.success)
            throw new Error(
                `${path}: unsupported settings: ${parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`,
            );
    }
    const carrier =
        reader === 'words'
            ? carryTypos
            : reader === 'advisories'
              ? carryOsv
              : reader === 'licenses'
                ? carryLicenses
                : CARRIERS[tool];
    if (carrier) await carrier(source, path, lists, root, check);
    else carryDisabled(source, tool, path, lists, check);
}
