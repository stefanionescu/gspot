// Takeover at init: delete the old configuration of every owned tool, carry the exception lists, list what no longer runs.
import { existsSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { parse as parseToml } from 'smol-toml';
import { parse as parseYaml } from 'yaml';
import { parse as parseJsonc } from 'jsonc-parser';

import { CARRIED_REASON } from '#config/reasons.ts';
import type { ExistingTooling, ScopeInfo } from '#types/repository.ts';
import type { Manifest } from '#types/manifest.ts';
import type { TakeoverPlan } from '#types/render.ts';

export type CarriedIgnore = { check: string; rule: string; reason: string; paths?: string[] };

export type CarriedLists = {
    typosWords: { word: string; reason: string }[];
    typosExcludes: { paths: string[]; reason: string }[];
    gitleaksAllow: { description: string; paths: string[]; regexes: string[]; reason: string }[];
    osvIgnores: { id: string; reason: string; review_by?: string }[];
    licenseExceptions: { package: string; license: string; reason: string }[];
    licenseAllow: string[];
    ignores: CarriedIgnore[];
    removed: { path: string; note: string }[];
};

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

const DELETED_WITH_OWNER: Record<string, string> = {
    prettierignore: 'formatting',
    sqlfluffignore: 'sql',
    semgrepignore: 'vulnerabilities',
    bearer: 'vulnerabilities',
    whitelizard: 'javascript',
    qlty: 'structure',
};

const OWNER_PRESET: Record<string, string[]> = {
    eslint: ['typescript', 'javascript'],
    prettier: ['formatting'],
    editorconfig: ['formatting'],
    typos: ['spelling'],
    markdownlint: ['markdown'],
    commitlint: ['commits'],
    shellcheck: ['bash'],
    sqlfluff: ['sql'],
    swiftlint: ['swift'],
    swiftformat: ['swift'],
    periphery: ['swift'],
    gitleaks: ['secrets'],
    osv: ['dependencies'],
    licenses: ['licenses'],
    squawk: ['postgres'],
    hadolint: ['docker'],
    stylelint: ['css'],
    'html-validate': ['html'],
    lychee: ['docs'],
    syncpack: ['dependencies'],
    knip: ['typescript', 'javascript'],
    jscpd: ['duplication'],
    pyright: ['python'],
    ruff: ['python'],
    yamllint: ['config-files'],
    taplo: ['config-files'],
    vale: ['prose'],
    trivy: ['docker'],
    linkinator: ['static-site'],
};

function reasonFor(file: string): string {
    return CARRIED_REASON.replace('{{file}}', file);
}

function readText(root: string, path: string): string {
    try {
        return readFileSync(join(root, path), 'utf8');
    } catch {
        return '';
    }
}

function commentAbove(lines: string[], index: number): string | undefined {
    const above: string[] = [];
    for (let i = index - 1; i >= 0; i -= 1) {
        const line = lines[i]!.trim();
        if (!line.startsWith('#') && !line.startsWith('//')) break;
        above.unshift(line.replace(/^(#|\/\/)\s?/, ''));
    }
    const text = above.join(' ').trim();
    return text === '' ? undefined : text;
}

function carryTypos(root: string, path: string, lists: CarriedLists): void {
    const text = readText(root, path);
    let data: Record<string, unknown>;
    try {
        data = parseToml(text) as Record<string, unknown>;
    } catch {
        return;
    }
    const lines = text.split('\n');
    const words = ((data['default'] as Record<string, unknown> | undefined)?.['extend-words'] ?? {}) as Record<
        string,
        string
    >;
    for (const word of Object.keys(words)) {
        const index = lines.findIndex((line) =>
            new RegExp(`^\\s*"?${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"?\\s*=`).test(line),
        );
        lists.typosWords.push({
            word,
            reason: (index >= 0 ? commentAbove(lines, index) : undefined) ?? reasonFor(path),
        });
    }
    const excludes = ((data['files'] as Record<string, unknown> | undefined)?.['extend-exclude'] ?? []) as string[];
    const kept = excludes.filter(
        (pattern) =>
            !/(node_modules|dist|build|coverage|\.lock$|\*\.(png|jpg|jpeg|gif|svg|mp3|mp4|ttf|woff2?|ico|zip|pdf)$|DerivedData|Pods|\.build)/.test(
                pattern,
            ),
    );
    if (kept.length > 0)
        lists.typosExcludes.push({
            paths: kept.map((pattern) => (pattern.endsWith('/') ? `${pattern}**` : pattern)),
            reason: reasonFor(path),
        });
}

function carryGitleaks(root: string, path: string, lists: CarriedLists): void {
    let data: Record<string, unknown>;
    try {
        data = parseToml(readText(root, path)) as Record<string, unknown>;
    } catch {
        return;
    }
    const entries: Record<string, unknown>[] = [];
    if (data['allowlist']) entries.push(data['allowlist'] as Record<string, unknown>);
    if (Array.isArray(data['allowlists'])) entries.push(...(data['allowlists'] as Record<string, unknown>[]));
    for (const entry of entries) {
        const description = String(entry['description'] ?? '');
        lists.gitleaksAllow.push({
            description,
            paths: (entry['paths'] as string[] | undefined) ?? [],
            regexes: (entry['regexes'] as string[] | undefined) ?? [],
            reason: description || reasonFor(path),
        });
    }
}

function carryOsv(root: string, path: string, lists: CarriedLists): void {
    let data: Record<string, unknown>;
    try {
        data = parseToml(readText(root, path)) as Record<string, unknown>;
    } catch {
        return;
    }
    for (const entry of (data['IgnoredVulns'] as Record<string, unknown>[] | undefined) ?? []) {
        const ignore: CarriedLists['osvIgnores'][number] = {
            id: String(entry['id']),
            reason: String(entry['reason'] ?? reasonFor(path)),
        };
        if (entry['ignoreUntil'] !== undefined) ignore.review_by = String(entry['ignoreUntil']).slice(0, 10);
        lists.osvIgnores.push(ignore);
    }
}

function carryLicenses(root: string, path: string, lists: CarriedLists): void {
    let data: Record<string, unknown>;
    try {
        data = JSON.parse(readText(root, path)) as Record<string, unknown>;
    } catch {
        return;
    }
    const exclude = data['excludePackages'];
    const packages =
        typeof exclude === 'string' ? exclude.split(';') : Array.isArray(exclude) ? (exclude as string[]) : [];
    for (const name of packages.map((item) => item.trim()).filter(Boolean))
        lists.licenseExceptions.push({ package: name, license: 'UNKNOWN', reason: reasonFor(path) });
    const only = data['onlyAllow'];
    const allow = typeof only === 'string' ? only.split(';') : Array.isArray(only) ? (only as string[]) : [];
    lists.licenseAllow.push(...allow.map((item) => item.trim()).filter(Boolean));
}

function carryDisabled(root: string, tool: string, path: string, lists: CarriedLists): void {
    const check = CHECK_BY_TOOL[tool];
    if (!check) return;
    const text = readText(root, path);
    const push = (rule: string, paths?: string[]) =>
        lists.ignores.push({ check, rule, reason: reasonFor(path), ...(paths ? { paths } : {}) });
    switch (tool) {
        case 'shellcheck': {
            for (const match of text.matchAll(/^\s*disable=([A-Z0-9,\s]+)$/gm))
                for (const code of match[1]!.split(',')) if (code.trim()) push(code.trim());
            return;
        }
        case 'sqlfluff': {
            const match = text.match(/^\s*exclude_rules\s*=\s*(.+)$/m);
            if (match) for (const code of match[1]!.split(',')) if (code.trim()) push(code.trim());
            return;
        }
        case 'squawk': {
            try {
                const data = parseToml(text) as { excluded_rules?: string[] };
                for (const rule of data.excluded_rules ?? []) push(rule);
            } catch {
                // unreadable: the person keeps the file
            }
            return;
        }
        case 'swiftlint': {
            try {
                const data = parseYaml(text) as { disabled_rules?: string[] } | undefined;
                for (const rule of data?.disabled_rules ?? []) push(rule);
            } catch {
                // same
            }
            return;
        }
        case 'markdownlint':
        case 'stylelint': {
            let data: Record<string, unknown> | undefined;
            try {
                data = (path.endsWith('.yaml') || path.endsWith('.yml') ? parseYaml(text) : parseJsonc(text)) as Record<
                    string,
                    unknown
                >;
            } catch {
                return;
            }
            const table =
                (tool === 'markdownlint'
                    ? ((data?.['config'] as Record<string, unknown> | undefined) ?? data)
                    : (data?.['rules'] as Record<string, unknown> | undefined)) ?? {};
            for (const [rule, value] of Object.entries(table)) if (value === false || value === null) push(rule);
            return;
        }
        case 'hadolint': {
            try {
                const data = parseYaml(text) as { ignored?: string[] } | undefined;
                for (const rule of data?.ignored ?? []) push(rule);
            } catch {
                // same
            }
            return;
        }
        case 'eslint': {
            for (const match of text.matchAll(
                /['"]?([@a-z0-9-]+(?:\/[a-z0-9-]+)*)['"]?\s*:\s*(?:['"]off['"]|0|\[\s*['"]off['"])/g,
            ))
                push(match[1]!);
            return;
        }
        case 'ruff': {
            try {
                const data = parseToml(text) as Record<string, unknown>;
                const lint =
                    (
                        (data['tool'] as Record<string, unknown> | undefined)?.['ruff'] as
                            | Record<string, unknown>
                            | undefined
                    )?.['lint'] ??
                    data['lint'] ??
                    data;
                const table = lint as { ignore?: string[]; 'per-file-ignores'?: Record<string, string[]> };
                for (const code of table.ignore ?? []) push(code);
                for (const [glob, codes] of Object.entries(table['per-file-ignores'] ?? {}))
                    for (const code of codes) push(code, [glob]);
            } catch {
                // same
            }
            return;
        }
        default:
            return;
    }
}

/** True when a selected preset owns a tool, or deletes its file along with the owner. */
export function ownedBy(tool: string, selected: Set<string>): boolean {
    const owners = OWNER_PRESET[tool] ?? [];
    if (owners.some((owner) => selected.has(owner))) return true;
    const deleter = DELETED_WITH_OWNER[tool];
    return deleter !== undefined && selected.has(deleter);
}

/** Reads the carry lists from every conventional configuration file an owned tool has. Deletes nothing. */
export function collectCarried(root: string, tooling: ExistingTooling, selected: Set<string>): CarriedLists {
    const lists: CarriedLists = {
        typosWords: [],
        typosExcludes: [],
        gitleaksAllow: [],
        osvIgnores: [],
        licenseExceptions: [],
        licenseAllow: [],
        ignores: [],
        removed: [],
    };
    for (const config of tooling.configs) {
        const { tool, path } = config;
        const owned =
            ownedBy(tool, selected) ||
            (DELETED_WITH_OWNER[tool] !== undefined && selected.has(DELETED_WITH_OWNER[tool]!));
        if (!owned) continue;
        if (tool === 'typos') carryTypos(root, path, lists);
        else if (tool === 'gitleaks') carryGitleaks(root, path, lists);
        else if (tool === 'osv') carryOsv(root, path, lists);
        else if (tool === 'licenses') carryLicenses(root, path, lists);
        else carryDisabled(root, tool, path, lists);
        lists.removed.push({ path, note: `replaced by gspot's ${tool} configuration` });
    }
    return lists;
}

/** The "no longer runs; delete when ready" list: hook directories, lint folders, lint-only manifests, duplicate pins. */
export function noLongerRuns(
    tooling: ExistingTooling,
    duplicatePins: { tool: string; version: string; place: string }[],
): TakeoverPlan['noLongerRuns'] {
    const list: TakeoverPlan['noLongerRuns'] = [];
    for (const hook of tooling.hooks)
        if (hook.kind === 'githooks' || hook.kind === 'hooksPath')
            list.push({ path: `${hook.path}/`, note: 'core.hooksPath now points at .gspot/hooks' });
    for (const folder of tooling.lintFolders)
        list.push({ path: `${folder}/`, note: 'a folder of lint scripts; nothing in the gate calls it' });
    for (const manifest of tooling.lintOnlyManifests)
        list.push({ path: manifest, note: 'a manifest whose dependencies are all tools gspot now pins' });
    if (duplicatePins.length > 0)
        list.push({
            path: duplicatePins[0]!.place,
            note: `${duplicatePins.length} pin${duplicatePins.length === 1 ? '' : 's'} gspot also pins (gspot doctor lists them)`,
        });
    return list;
}

/** Deletes the files takeover replaces. Git keeps them. */
export function deleteReplaced(root: string, removed: { path: string }[]): string[] {
    const deleted: string[] = [];
    for (const entry of removed) {
        const full = join(root, entry.path);
        if (!existsSync(full)) continue;
        rmSync(full, { recursive: statSync(full).isDirectory(), force: true });
        deleted.push(entry.path);
    }
    return deleted;
}

/** Owned tools among the ones found, given the selection. */
export function ownedTools(tooling: ExistingTooling, selected: Set<string>): string[] {
    return [
        ...new Set(tooling.configs.filter((config) => ownedBy(config.tool, selected)).map((config) => config.tool)),
    ].sort();
}

/** Tools found for which no selected preset exists. */
export function unownedTools(
    tooling: ExistingTooling,
    selected: Set<string>,
    manifests: Map<string, Manifest>,
): string[] {
    const known = new Set<string>();
    for (const manifest of manifests.values()) for (const tool of manifest.tools) known.add(tool.name);
    return [
        ...new Set(
            tooling.configs
                .filter(
                    (config) =>
                        !ownedBy(config.tool, selected) &&
                        !(DELETED_WITH_OWNER[config.tool] && selected.has(DELETED_WITH_OWNER[config.tool]!)),
                )
                .map((config) => config.tool),
        ),
    ].sort();
}

/** The scope a configuration path belongs to. */
export function scopeOfConfig(path: string, scopes: ScopeInfo[]): string {
    for (const scope of scopes) if (scope.path !== '' && path.startsWith(`${scope.path}/`)) return scope.path;
    return '';
}
