import { namingLists } from '#cli/parsers/schema/naming.ts';
import { trimTrailingSlashes } from '#cli/platform/paths.ts';
import { compact, valueAt, isRecord } from '#cli/platform/objects.ts';
import { prefixScopePath, scopePolicyPaths } from '#cli/policy/paths.ts';
import { configurationSettingSchemas } from '#cli/policy/schema/namespaces.ts';
import { defaultValue, namingCategorySchema } from '#cli/policy/schema/fields.ts';
import { policySchema, policyTableValuesSchema } from '#cli/policy/schema/policy.ts';

import type {
    Limits,
    Policy,
    RawScope,
    RawLimits,
    RawNaming,
    RawPolicy,
    NamingTable,
    NamingSettings,
    NamingLanguageTable,
} from '#cli/types/policy/settings.ts';

function normalizeCategory(raw: NamingTable): NamingTable {
    return compact({ max_chars: raw.max_chars, max_words: raw.max_words, case: raw.case });
}

function normalizeLanguage(table: RawNaming[string]): NamingLanguageTable {
    const language: NamingLanguageTable = { ...normalizeCategory(table), categories: {} };
    for (const [inner, entry] of Object.entries(table))
        if (!Object.hasOwn(namingCategorySchema.shape, inner) && isRecord(entry))
            language.categories[inner] = normalizeCategory(entry);
    return language;
}

function normalizeScopeTables(authored: RawScope, path: string): Policy['scopeTables'][string] {
    const raw = scopePolicyPaths(authored, path);
    // The tables a scope holds as written.
    const table: Policy['scopeTables'][string] = compact({
        authored,
        configurationSettings: configurationTables(raw),
        reasons: raw.reasons,
        tools: raw.tools && compact(raw.tools),
        test_files: raw.test_files,
        tool_timeout_seconds: raw.tool_timeout_seconds,
    });
    if (raw.limits) table.limits = normalizeLimits(raw.limits);
    if (raw.naming) table.naming = normalizeNaming(raw.naming);
    if (raw.architecture) table.architecture = normalizeArchitecture(raw.architecture, path);
    if (raw.structure)
        table.structure = {
            reexports: defaultValue(policySchema.shape.structure.unwrap().shape.reexports, raw.structure.reexports),
        };
    if (raw.format) table.format = compact(raw.format);
    return table;
}

function configurationTables(raw: object): Record<string, Record<string, unknown>> {
    return Object.fromEntries(
        Object.keys(configurationSettingSchemas).flatMap((name) => {
            const value = valueAt(raw, [name]);
            return isRecord(value) ? [[name, value]] : [];
        }),
    );
}

/**
 * Splits [limits] into plain root limits and per-language groups.
 * @param raw the table as written, if any
 * @returns the limits
 */
function normalizeLimits(raw: RawLimits = {}): Limits {
    const limits: Limits = { root: {}, groups: {} };
    const entries = Object.entries(raw);
    for (const [key, value] of entries) {
        if (typeof value === 'number') {
            limits.root[key] = value;
            continue;
        }
        limits.groups[key] = compact(value);
    }
    return limits;
}

/**
 * Fills the naming lists and splits the per-language tables from the list keys.
 * @param raw the table as written, if any
 * @returns the naming configuration
 */
function normalizeNaming(raw: RawNaming = {}): NamingSettings {
    const lists = namingLists.parse(raw);
    const naming: NamingSettings = {
        ...lists,
        overrides: lists.overrides.map((entry) => compact(entry)),
        languages: {},
    };
    for (const key of Object.keys(raw)) {
        const value = raw[key];
        if (!Object.hasOwn(namingLists.shape, key) && value !== undefined)
            naming.languages[key] = normalizeLanguage(value);
    }
    return naming;
}

/**
 * Fills the architecture table's lists and keeps its optional keys only when written.
 * @param raw the table as written, if any
 * @param scope the scope owning path selectors; module identities remain unchanged
 * @returns the architecture configuration
 */
function normalizeArchitecture(raw: RawPolicy['architecture'], scope = ''): Policy['architecture'] {
    const fields = policySchema.shape.architecture.unwrap().shape;
    const modules = defaultValue(fields.modules, raw?.modules);
    const names = new Set(modules.map((module) => module.name));
    const roles = defaultValue(fields.roles, raw?.roles);
    return {
        modules: modules.map((module) => compact({ ...module, may_import: module.may_import ?? [] })),
        roles: defaultValue(
            fields.roles,
            Object.fromEntries(
                Object.entries(compact(roles)).map(([role, value]) => {
                    const paths = [value]
                        .flat()
                        .map((entry) => (names.has(entry) ? entry : prefixScopePath(entry, scope)));
                    return [role, typeof value === 'string' ? paths[0] : paths];
                }),
            ),
        ),
    };
}

function normalizeChecks(checks: RawPolicy['check']): Policy['check'] {
    return Object.fromEntries(
        Object.entries({ ...checks }).map(([name, entry]) => {
            const { paths, ...definition } = compact({ ...entry, output: entry.output && compact(entry.output) });
            return [
                name,
                {
                    ...definition,
                    name,
                    level: 'recommended',
                    runs: 'files',
                    summary: entry.summary ?? `Runs the repository's own check ${name}.`,
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
                },
            ];
        }),
    );
}

/**
 * The whole document in Policy shape.
 * @param raw the validated document
 * @returns the policy
 */
export function buildPolicy(raw: RawPolicy): Policy {
    const tables = policyTableValuesSchema.parse({
        agent_rules: defaultValue(policySchema.shape.agent_rules, raw.agent_rules),
        hooks: raw.hooks,
        ci: raw.ci,
    });
    const scopeTables: Policy['scopeTables'] = {};
    const scopes = Object.entries({ ...raw.scope });
    for (const [path, scope] of scopes)
        scopeTables[trimTrailingSlashes(path)] = normalizeScopeTables(scope, trimTrailingSlashes(path));
    return {
        authored: raw,
        level: defaultValue(policySchema.shape.level, raw.level),
        reasons: { ...raw.reasons },
        exclude: defaultValue(policySchema.shape.exclude, raw.exclude),
        configurations: raw.configurations ?? [],
        configurationSettings: configurationTables(raw),
        scope: Object.fromEntries(
            scopes.map(([path, scope]) => [
                trimTrailingSlashes(path),
                {
                    configurations: scope.configurations ?? [],
                    removed_configurations: scope.removed_configurations ?? [],
                },
            ]),
        ),
        removed_configurations: defaultValue(policySchema.shape.removed_configurations, raw.removed_configurations),
        limits: normalizeLimits(raw.limits),
        naming: normalizeNaming(raw.naming),
        architecture: normalizeArchitecture(raw.architecture),
        structure: {
            reexports: defaultValue(policySchema.shape.structure.unwrap().shape.reexports, raw.structure?.reexports),
        },
        format: compact({ ...raw.format }),
        words: defaultValue(policySchema.shape.words, raw.words),
        tools: compact({ ...raw.tools }),
        test_files: defaultValue(policySchema.shape.test_files, raw.test_files),
        ignore: (raw.ignore ?? []).map((entry) => compact(entry)),
        declarations: [
            ...defaultValue(policySchema.shape.generated, raw.generated).map((entry) => ({
                ...entry,
                kind: 'generated' as const,
            })),
            ...defaultValue(policySchema.shape.vendored, raw.vendored).map((entry) => ({
                ...entry,
                kind: 'vendored' as const,
            })),
        ],
        check: normalizeChecks(raw.check),

        ...compact({
            runner: raw.runner,
            tool_timeout_seconds: raw.tool_timeout_seconds,
        }),
        ...tables,
        scopeTables,
    };
}
