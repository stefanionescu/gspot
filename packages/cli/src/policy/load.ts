// Read, parse and validate gspot.toml and gspot.local.toml; normalize into the Policy shape.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { parse as parseToml } from 'smol-toml';
import type { z } from 'zod';

import * as messages from '#cli/policy/messages.ts';
import { localSchema } from '#cli/policy/local-schema.ts';
import { reasonAccepted } from '#cli/policy/loosening.ts';
import { policySchema } from '#cli/policy/schema.ts';
import type { RawLimits, RawNaming, RawPolicy, RawScope } from '#cli/policy/schema.ts';
import type {
    Limits,
    LoadedPolicy,
    LocalPolicy,
    NamingCategoryTable,
    NamingConfig,
    NamingLanguageTable,
    Policy,
    Reasoned,
} from '#types/config.ts';

const NAMING_LIST_KEYS = new Set([
    'banned_terms',
    'allowed',
    'external',
    'reserved',
    'remove_groups',
    'contract_properties',
    'rules',
]);
const CATEGORY_KEYS = new Set(['max_chars', 'max_words', 'case']);
const GLOB_CHARS = /[*?{}[\]!]/;

type Compact<T> = { [K in keyof T]: Exclude<T[K], undefined> };

function compact<T extends object>(value: T): Compact<T> {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Compact<T>;
}

function compactAll<T extends object>(values: T[] | undefined): Compact<T>[] {
    return (values ?? []).map(compact);
}

export class PolicyError extends Error {
    readonly problems: string[];

    constructor(problems: string[]) {
        super(problems.join('\n'));
        this.name = 'PolicyError';
        this.problems = problems;
    }
}

function shapeAt(schema: unknown, path: (string | number)[]): string[] {
    let current: unknown = schema;
    for (const segment of path) {
        const def = (current as { def?: Record<string, unknown> }).def;
        if (!def) return [];
        if (def['type'] === 'object') {
            const shape = (def['shape'] ?? (current as { shape?: Record<string, unknown> }).shape) as
                | Record<string, unknown>
                | undefined;
            const next = shape?.[String(segment)] ?? def['catchall'];
            if (!next) return [];
            current = next;
        } else if (def['type'] === 'array') current = def['element'];
        else if (def['type'] === 'record') current = def['valueType'];
        else if (def['type'] === 'optional' || def['type'] === 'nullable') {
            current = def['innerType'];
            const inner = shapeAt(current, [segment]);
            return inner;
        } else if (def['type'] === 'union') {
            for (const option of def['options'] as unknown[]) {
                const keys = shapeAt(option, path);
                if (keys.length > 0) return keys;
            }
            return [];
        } else return [];
    }
    let target = current as { def?: Record<string, unknown>; shape?: Record<string, unknown> };
    while (target.def && (target.def['type'] === 'optional' || target.def['type'] === 'nullable'))
        target = target.def['innerType'] as typeof target;
    const shape = (target.shape ?? target.def?.['shape']) as Record<string, unknown> | undefined;
    return shape ? Object.keys(shape) : [];
}

function issueMessage(issue: z.core.$ZodIssue): string {
    const where = issue.path.map(String).join('.');
    if (issue.code === 'unrecognized_keys') {
        const known = shapeAt(
            policySchema,
            issue.path.filter((segment): segment is string | number => typeof segment !== 'symbol'),
        );
        return issue.keys.map((key) => messages.unknownKey(where, key, known)).join('\n');
    }
    if (issue.code === 'invalid_type')
        return messages.invalidValue(
            where === '' ? 'gspot.toml' : where,
            `expected ${issue.expected}, got ${typeof issue.input}`,
        );
    return messages.invalidValue(where === '' ? 'gspot.toml' : where, issue.message);
}

function toReasoned<T>(value: T | { value: T; reason: string }): Reasoned<T> {
    if (typeof value === 'object' && value !== null && 'value' in value && 'reason' in value) {
        const entry = value as { value: T; reason: string };
        return { value: entry.value, reason: entry.reason };
    }
    return { value: value as T };
}

function normalizeLimits(raw: RawLimits | undefined): Limits {
    const limits: Limits = { root: {}, groups: {} };
    for (const [key, value] of Object.entries(raw ?? {})) {
        if (typeof value === 'object' && value !== null && !('value' in value)) {
            const group: Record<string, Reasoned<number>> = {};
            for (const [inner, entry] of Object.entries(
                value as Record<string, number | { value: number; reason: string }>,
            ))
                group[inner] = toReasoned(entry);
            limits.groups[key] = group;
        } else limits.root[key] = toReasoned(value as number | { value: number; reason: string });
    }
    return limits;
}

function normalizeCategory(raw: Record<string, unknown>): NamingCategoryTable {
    const table: NamingCategoryTable = {};
    if (raw['max_chars'] !== undefined) table.max_chars = toReasoned(raw['max_chars'] as number);
    if (raw['max_words'] !== undefined) table.max_words = toReasoned(raw['max_words'] as number);
    if (raw['case'] !== undefined) table.case = toReasoned(raw['case'] as string[]);
    return table;
}

function normalizeNaming(raw: RawNaming | undefined): NamingConfig {
    const naming: NamingConfig = {
        banned_terms: raw?.banned_terms ?? [],
        allowed: raw?.allowed ?? [],
        external: raw?.external ?? [],
        reserved: raw?.reserved ?? [],
        remove_groups: raw?.remove_groups ?? [],
        contract_properties: raw?.contract_properties ?? [],
        languages: {},
        rules: compactAll(raw?.rules),
    };
    for (const [key, value] of Object.entries(raw ?? {})) {
        if (NAMING_LIST_KEYS.has(key) || typeof value !== 'object' || value === null) continue;
        const table = value as Record<string, unknown>;
        const language: NamingLanguageTable = { ...normalizeCategory(table), categories: {} };
        for (const [inner, entry] of Object.entries(table)) {
            if (CATEGORY_KEYS.has(inner)) continue;
            language.categories[inner] = normalizeCategory(entry as Record<string, unknown>);
        }
        naming.languages[key] = language;
    }
    return naming;
}

function normalizeScopeTables(raw: RawScope): Partial<Policy> {
    const table: Partial<Policy> = {};
    if (raw.limits) table.limits = normalizeLimits(raw.limits);
    if (raw.naming) table.naming = normalizeNaming(raw.naming);
    if (raw.architecture) table.architecture = normalizeArchitecture(raw.architecture);
    if (raw.structure) table.structure = normalizeStructure(raw.structure);
    if (raw.tools) table.tools = raw.tools as Policy['tools'];
    if (raw.format) table.format = compact(raw.format);
    return table;
}

function normalizeArchitecture(raw: RawPolicy['architecture']): Policy['architecture'] {
    return {
        ...(raw?.types_directory !== undefined ? { types_directory: raw.types_directory } : {}),
        elements: raw?.elements ?? [],
        allow: compactAll(raw?.allow),
        roles: raw?.roles ?? {},
        contracts: raw?.contracts ?? [],
        ...(raw?.package_roots ? { package_roots: raw.package_roots } : {}),
        ...(raw?.route_directories ? { route_directories: raw.route_directories } : {}),
        ...(raw?.shared_directories ? { shared_directories: raw.shared_directories } : {}),
        ...(raw?.feature_contracts ? { feature_contracts: raw.feature_contracts } : {}),
        allowed_imports: raw?.allowed_imports ?? [],
    };
}

function normalizeStructure(raw: RawPolicy['structure']): Policy['structure'] {
    return {
        reexports: raw?.reexports ?? 'none',
        call_through_allowed: raw?.call_through_allowed ?? [],
        trivial_exemptions: compactAll(raw?.trivial_exemptions),
        single_file_folder_allowed: raw?.single_file_folder_allowed ?? [],
        prefix_collision_allowed: raw?.prefix_collision_allowed ?? [],
        folder_name_allowed: raw?.folder_name_allowed ?? [],
        python: raw?.python ?? {},
    };
}

function normalize(raw: RawPolicy): Policy {
    const scopeTables: Record<string, Partial<Policy>> = {};
    for (const scope of raw.scope ?? []) scopeTables[scope.path] = normalizeScopeTables(scope);
    return {
        version: raw.version,
        presets: raw.presets ?? [],
        scopes: (raw.scope ?? []).map((scope) => ({
            path: scope.path.replace(/\/+$/, ''),
            presets: scope.presets ?? [],
        })),
        limits: normalizeLimits(raw.limits),
        naming: normalizeNaming(raw.naming),
        architecture: normalizeArchitecture(raw.architecture),
        structure: normalizeStructure(raw.structure),
        format: compact(raw.format ?? {}),
        prose: { vocabulary: raw.prose?.vocabulary ?? [], disabled: raw.prose?.disabled ?? [] },
        tools: (raw.tools ?? {}) as Policy['tools'],
        ignores: compactAll(raw.ignore),
        declares: compactAll(raw.declare),
        checks: compactAll(raw.check),
        hooks: { manager: raw.hooks?.manager ?? 'gspot' },
        ci: { provider: raw.ci?.provider ?? 'none', platforms: raw.ci?.platforms ?? ['ubuntu'] },
        rules: {
            install: raw.rules?.install ?? true,
            directory: raw.rules?.directory ?? '.gspot/rules',
            ...(raw.rules?.project ? { project: raw.rules.project } : {}),
        },
        editor: { vscode: raw.editor?.vscode ?? false },
        coverage: { strict: raw.coverage?.strict ?? false },
        runner: { surface: raw.runner?.surface ?? 'none' },
        scopeTables,
    };
}

function selectorProblems(selectors: string[], where: string): string[] {
    const problems: string[] = [];
    for (const selector of selectors) {
        const last = selector.split('/').pop() ?? selector;
        if (!GLOB_CHARS.test(selector) && !last.includes('.') && !selector.endsWith('/'))
            problems.push(`${where}: ${messages.bareDirectory(selector)}`);
    }
    return problems;
}

function reasonProblems(policy: Policy): string[] {
    const problems: string[] = [];
    const need = (where: string, reason: string | undefined, command: string) => {
        if (reason === undefined) problems.push(messages.missingReason(where, command));
        else if (!reasonAccepted(reason)) problems.push(messages.refusedReason(where, reason));
    };
    policy.ignores.forEach((entry, index) => {
        need(
            `[[ignore]] entry ${index + 1} (${entry.check})`,
            entry.reason,
            `gspot ignore ${entry.check} --reason "..."`,
        );
        problems.push(...selectorProblems(entry.paths ?? [], `[[ignore]] ${entry.check}`));
    });
    policy.declares.forEach((entry, index) => {
        problems.push(...selectorProblems(entry.paths, `[[declare]] entry ${index + 1}`));
        if (entry.vendored)
            need(
                `[[declare]] entry ${index + 1} (vendored)`,
                entry.reason,
                `gspot declare ${entry.paths[0]} --vendored --reason "..."`,
            );
        if (!entry.produced_by && !entry.vendored && entry.reason === undefined)
            problems.push(
                messages.checkEntryIncomplete(`declare ${entry.paths[0]}`, 'produced_by, vendored or reason'),
            );
    });
    const reasoned = (where: string, value: Reasoned<unknown> | undefined) => {
        if (value?.reason !== undefined && !reasonAccepted(value.reason))
            problems.push(messages.refusedReason(where, value.reason));
    };
    for (const [key, value] of Object.entries(policy.limits.root)) reasoned(`limits.${key}`, value);
    for (const [group, table] of Object.entries(policy.limits.groups))
        for (const [key, value] of Object.entries(table)) reasoned(`limits.${group}.${key}`, value);
    for (const entry of policy.naming.allowed)
        need(`naming.allowed ${entry.name}`, entry.reason, `gspot allow naming ${entry.name} --reason "..."`);
    for (const entry of policy.naming.remove_groups)
        need(
            `naming.remove_groups ${entry.group}`,
            entry.reason,
            `gspot set naming.remove_groups ${entry.group} --reason "..."`,
        );
    for (const rule of policy.naming.rules) {
        problems.push(...selectorProblems(rule.paths, '[[naming.rules]]'));
        if (rule.exclude)
            need(`[[naming.rules]] excluding ${(rule.names ?? []).join(', ')}`, rule.reason, 'add reason = "..."');
    }
    for (const entry of policy.structure.call_through_allowed)
        need(`structure.call_through_allowed ${entry.name}`, entry.reason, 'add reason = "..."');
    for (const [tool, table] of Object.entries(policy.tools)) {
        if (table.extra !== undefined) {
            if (!reasonAccepted(table.extra.reason)) problems.push(messages.extraNeedsReason(tool));
        }
        if (table.enabled !== undefined) {
            const enabled = toReasoned(table.enabled as boolean | { value: boolean; reason: string });
            if (enabled.value === false)
                need(
                    `tools.${tool}.enabled = false`,
                    enabled.reason,
                    `gspot set tools.${tool}.enabled false --reason "..."`,
                );
        }
        for (const [slot, value] of Object.entries(table)) {
            if (slot === 'extra' || slot === 'enabled') continue;
            if (slot === 'rules' && typeof value === 'object' && value !== null) {
                for (const [rule, option] of Object.entries(value as Record<string, unknown>)) {
                    if (option === 'off' || (Array.isArray(option) && option[0] === 'off'))
                        problems.push(messages.ruleOffRefused(`<check that runs ${tool}>`, rule));
                }
            }
        }
    }
    for (const entry of policy.checks) {
        if (entry.paths.length === 0) problems.push(messages.checkEntryIncomplete(entry.id, 'paths'));
        problems.push(...selectorProblems(entry.paths, `[[check]] ${entry.id}`));
    }
    return problems;
}

function scopeProblems(root: string, policy: Policy): string[] {
    const problems: string[] = [];
    const paths = policy.scopes.map((scope) => scope.path);
    for (const path of paths) {
        const full = join(root, path);
        if (!existsSync(full) || !statSync(full).isDirectory()) problems.push(messages.scopeMissing(path));
    }
    for (const outer of paths)
        for (const inner of paths)
            if (inner !== outer && inner.startsWith(`${outer}/`)) problems.push(messages.scopesNest(outer, inner));
    return problems;
}

/** Parses and validates the text of a gspot.toml. Throws PolicyError with every problem found. */
export function parsePolicyText(text: string, path: string, root?: string): Policy {
    let data: unknown;
    try {
        data = parseToml(text);
    } catch (error) {
        throw new PolicyError([messages.tomlSyntax(path, (error as Error).message)]);
    }
    const result = policySchema.safeParse(data);
    if (!result.success) throw new PolicyError(result.error.issues.map(issueMessage));
    if (result.data.version !== 1) throw new PolicyError([messages.versionUnsupported(result.data.version)]);
    const policy = normalize(result.data);
    const problems = [...reasonProblems(policy), ...(root ? scopeProblems(root, policy) : [])];
    if (problems.length > 0) throw new PolicyError(problems);
    return policy;
}

/** Parses gspot.local.toml. Any key but skip is refused. */
export function parseLocalText(text: string): LocalPolicy {
    let data: unknown;
    try {
        data = parseToml(text);
    } catch (error) {
        throw new PolicyError([messages.tomlSyntax('gspot.local.toml', (error as Error).message)]);
    }
    const result = localSchema.safeParse(data);
    if (!result.success) {
        throw new PolicyError(
            result.error.issues.map((issue) =>
                issue.code === 'unrecognized_keys'
                    ? issue.keys.map(messages.localOnlySkip).join('\n')
                    : issueMessage(issue),
            ),
        );
    }
    return { skip: result.data.skip ?? [] };
}

/** The path of gspot.toml under a root. */
export function policyPath(root: string): string {
    return join(root, 'gspot.toml');
}

/** True when a root has a gspot.toml. */
export function hasPolicy(root: string): boolean {
    return existsSync(policyPath(root));
}

/** Loads gspot.toml and gspot.local.toml from a repository root. */
export function loadPolicy(root: string): LoadedPolicy {
    const path = policyPath(root);
    if (!existsSync(path)) throw new PolicyError([messages.fileMissing('gspot.toml')]);
    const text = readFileSync(path, 'utf8');
    const policy = parsePolicyText(text, 'gspot.toml', root);
    const localPath = join(root, 'gspot.local.toml');
    const local = existsSync(localPath) ? parseLocalText(readFileSync(localPath, 'utf8')) : { skip: [] };
    return { policy, local, path, text };
}
