import { namingLists } from '#cli/parsers/schema/naming.ts';
import { policySchema } from '#cli/policy/schema/policy.ts';
import { compact, isRecord } from '#cli/platform/objects.ts';
import { isReasoned, namingCategorySchema } from '#cli/policy/schema/fields.ts';
import { configurationSettingSchemas } from '#cli/policy/schema/configurations.ts';

import type {
    Limits,
    Policy,
    RawScope,
    Reasoned,
    RawLimits,
    RawNaming,
    RawPolicy,
    NamingTable,
    NamingSettings,
    NamingLanguageTable,
} from '#cli/types/policy/settings.ts';

function normalizeCategory(raw: Record<string, unknown>): NamingTable {
    const table: NamingTable = {};
    if (raw['max_chars'] !== undefined) table.max_chars = toReasoned(raw['max_chars'] as number);
    if (raw['max_words'] !== undefined) table.max_words = toReasoned(raw['max_words'] as number);
    if (raw['case'] !== undefined) table.case = toReasoned(raw['case'] as string[]);
    return table;
}

function normalizeLanguage(table: Record<string, unknown>): NamingLanguageTable {
    const language: NamingLanguageTable = { ...normalizeCategory(table), categories: {} };
    for (const [inner, entry] of Object.entries(table))
        if (!Object.hasOwn(namingCategorySchema.shape, inner) && isRecord(entry))
            language.categories[inner] = normalizeCategory(entry);
    return language;
}

function normalizeScopeTables(raw: RawScope): Partial<Policy> {
    // The tables a scope holds as written.
    const table: Partial<Policy> = compact({
        configurationSettings: configurationTables(raw),
        tools: raw.tools as Policy['tools'] | undefined,
        tests: raw.tests,
        tool_timeout_seconds: raw.tool_timeout_seconds,
    });
    if (raw.limits) table.limits = normalizeLimits(raw.limits);
    if (raw.naming) table.naming = normalizeNaming(raw.naming);
    if (raw.architecture) table.architecture = normalizeArchitecture(raw.architecture);
    if (raw.structure) table.structure = raw.structure;
    if (raw.format) table.format = compact(raw.format);
    return table;
}

function configurationTables(raw: object): Record<string, Record<string, unknown>> {
    const tables = new Map<string, unknown>(Object.entries(raw));
    return Object.fromEntries(
        Object.keys(configurationSettingSchemas).flatMap((name) => {
            const value = tables.get(name);
            return isRecord(value) ? [[name, value]] : [];
        }),
    );
}

function trimTrailingSlashes(path: string): string {
    let end = path.length;
    while (end > 0 && path[end - 1] === '/') end -= 1;
    return path.slice(0, end);
}

/**
 * Wraps a bare value or a { value, reason } table into the reasoned form.
 * @param value the value as written
 * @returns the value with its reason when it had one
 */
function toReasoned<T>(value: T | Required<Reasoned<T>>): Reasoned<T> {
    if (isReasoned(value)) return value;
    return { value: value };
}

/**
 * Splits [limits] into root limits and groups, every value reasoned.
 * @param raw the table as written, if any
 * @returns the limits
 */
function normalizeLimits(raw: RawLimits | undefined): Limits {
    const limits: Limits = { root: {}, groups: {} };
    const entries = Object.entries(raw ?? {});
    for (const [key, value] of entries) {
        if (!isRecord(value) || isReasoned(value)) {
            limits.root[key] = toReasoned(value as number | Required<Reasoned<number>>);
            continue;
        }
        limits.groups[key] = Object.fromEntries(
            Object.entries(value).map(([inner, entry]) => [inner, toReasoned(entry as number | unknown[])]),
        );
    }
    return limits;
}

/**
 * Fills the naming lists and splits the per-language tables from the list keys.
 * @param raw the table as written, if any
 * @returns the naming configuration
 */
function normalizeNaming(raw: RawNaming | undefined): NamingSettings {
    const lists = namingLists.parse(raw ?? {});
    const naming: NamingSettings = {
        ...lists,
        paths: lists.paths.map((entry) => compact(entry)),
        languages: {},
    };
    const entries = Object.entries(raw ?? {});
    for (const [key, value] of entries)
        if (!Object.hasOwn(namingLists.shape, key) && isRecord(value)) naming.languages[key] = normalizeLanguage(value);
    return naming;
}

/**
 * Fills the architecture table's lists and keeps its optional keys only when written.
 * @param raw the table as written, if any
 * @returns the architecture configuration
 */
function normalizeArchitecture(raw: RawPolicy['architecture']): Policy['architecture'] {
    const filled = policySchema.shape.architecture.unwrap().parse(raw ?? {});
    return compact({ ...filled, imports_allowed: filled.imports_allowed.map((entry) => compact(entry)) });
}

function normalizeChecks(checks: RawPolicy['check']): Policy['checks'] {
    return (checks ?? []).map((entry) => {
        const { paths, ...definition } = compact({ ...entry, output: entry.output && compact(entry.output) });
        return {
            ...definition,
            level: 'recommended',
            runs: 'files',
            summary: entry.summary ?? `Runs the repository's own check ${entry.name}.`,
            why: 'The repository declared this command in gspot.toml as part of its gate.',
            help: entry.help ?? 'Read the command output; the repository owns this check.',
            files: {
                extensions: [],
                filenames: [],
                tags: [],
                paths,
                languages: false,
                prettier_plugins: false,
                eslint_plugins: false,
                kinds: ['source', 'generated'],
            },
        };
    });
}

/**
 * The whole document in Policy shape.
 * @param raw the validated document
 * @returns the policy
 */
export function buildPolicy(raw: RawPolicy): Policy {
    const scopeTables: Record<string, Partial<Policy>> = {};
    const scopes = raw.scope ?? [];
    for (const scope of scopes) scopeTables[trimTrailingSlashes(scope.path)] = normalizeScopeTables(scope);
    return {
        level: raw.level,
        require_reasons: raw.require_reasons,
        extra_checks: raw.extra_checks,
        exclude: raw.exclude,
        configurations: raw.configurations ?? [],
        configurationSettings: configurationTables(raw),
        scopes: scopes.map((scope) => ({
            path: trimTrailingSlashes(scope.path),
            configurations: scope.configurations ?? [],
        })),
        limits: normalizeLimits(raw.limits),
        naming: normalizeNaming(raw.naming),
        architecture: normalizeArchitecture(raw.architecture),
        structure: policySchema.shape.structure.unwrap().parse(raw.structure ?? {}),
        format: compact({ ...raw.format }),
        prose: policySchema.shape.prose.unwrap().parse(raw.prose ?? {}),
        tools: { ...raw.tools } as Policy['tools'],
        tests: raw.tests,
        ignores: (raw.ignore ?? []).map((entry) => compact(entry)),
        declarations: [
            ...raw.generated.map((entry) => ({ ...entry, kind: 'generated' as const })),
            ...raw.vendored.map((entry) => ({ ...entry, kind: 'vendored' as const })),
        ],
        checks: normalizeChecks(raw.check),

        ...compact({
            hooks: raw.hooks,
            ci: raw.ci,
            run_with: raw.run_with,
            tool_timeout_seconds: raw.tool_timeout_seconds,
        }),
        agentRules: compact(raw.agent_rules),
        scopeTables,
    };
}
