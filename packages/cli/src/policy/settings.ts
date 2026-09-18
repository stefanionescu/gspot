// The settings surface: every key the selection exposes, its direction, default, and current value with its source.
import { isLoosening, reasonAccepted } from '#cli/policy/loosening.ts';
import * as messages from '#cli/policy/messages.ts';
import { nearMatches } from '#cli/policy/near.ts';
import type { Policy, Reasoned } from '#types/config.ts';
import type { Manifest, SettingSpec } from '#types/manifest.ts';

export type ResolvedSetting = {
    key: string;
    spec: SettingSpec;
    value: unknown;
    reason?: string;
    source: string;
    scope?: string;
};

export type SettingsSurface = {
    specs: Map<string, SettingSpec>;
    defaults: Map<string, { value: unknown; preset: string }>;
    problems: string[];
};

const LANGUAGE_GROUP_TABLES = new Set(['limits', 'naming']);

function isReasoned(value: unknown): value is Reasoned<unknown> {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        'value' in value &&
        Object.keys(value).every((key) => key === 'value' || key === 'reason')
    );
}

function plain(value: unknown): { value: unknown; reason?: string } {
    if (isReasoned(value))
        return value.reason === undefined ? { value: value.value } : { value: value.value, reason: value.reason };
    return { value };
}

/** Builds the surface from the selected manifests in selection order; later framework and platform presets override scalar defaults. */
export function buildSurface(selected: Manifest[]): SettingsSurface {
    const specs = new Map<string, SettingSpec>();
    const defaults = new Map<string, { value: unknown; preset: string }>();
    const problems: string[] = [];
    for (const manifest of selected) {
        for (const spec of manifest.settings) {
            const existing = specs.get(spec.name);
            if (!existing) specs.set(spec.name, spec);
            if (spec.default === undefined) continue;
            const previous = defaults.get(spec.name);
            if (
                previous &&
                previous.preset !== manifest.preset.id &&
                JSON.stringify(previous.value) !== JSON.stringify(spec.default)
            ) {
                const overrides =
                    manifest.preset.kind === 'framework' ||
                    manifest.preset.kind === 'platform' ||
                    manifest.preset.kind === 'library';
                if (!overrides && existing?.kind !== 'list') {
                    problems.push(messages.conflictingScalars(spec.name, previous.preset, manifest.preset.id));
                    continue;
                }
            }
            defaults.set(spec.name, { value: spec.default, preset: manifest.preset.id });
        }
        for (const tool of manifest.tools) {
            const enabledKey = `tools.${tool.name}.enabled`;
            if (!specs.has(enabledKey)) {
                specs.set(enabledKey, {
                    name: enabledKey,
                    kind: 'boolean',
                    direction: 'loosening',
                    default: true,
                    summary: `Whether the ${tool.name} checks run. Turning it off needs a reason.`,
                });
                defaults.set(enabledKey, { value: true, preset: manifest.preset.id });
            }
        }
    }
    return { specs, defaults, problems };
}

function keyParts(key: string): string[] {
    return key.split('.');
}

/** Matches a written key to the spec it belongs to: per-language and per-category variants map back to their base spec. */
export function specFor(
    surface: SettingsSurface,
    key: string,
): { spec: SettingSpec; language?: string; category?: string } | undefined {
    const direct = surface.specs.get(key);
    if (direct) return { spec: direct };
    const parts = keyParts(key);
    if (parts.length >= 3 && LANGUAGE_GROUP_TABLES.has(parts[0]!)) {
        const [table, language, ...rest] = parts;
        if (rest.length === 1) {
            const base = surface.specs.get(`${table}.${rest[0]}`);
            if (base && (base.languages?.includes(language!) || base.languages?.includes('*')))
                return { spec: base, language: language! };
            const grouped = surface.specs.get(key);
            if (grouped) return { spec: grouped };
        }
        if (rest.length === 2 && table === 'naming') {
            const base = surface.specs.get(`naming.${rest[1]}`);
            if (base && base.languages?.includes(language!) && base.categories?.includes(rest[0]!))
                return { spec: base, language: language!, category: rest[0]! };
        }
    }
    return undefined;
}

/** Reads the raw value a policy holds for a dotted key, or undefined. */
export function policyValue(policy: Partial<Policy>, key: string): { value: unknown; reason?: string } | undefined {
    const parts = keyParts(key);
    const [table, ...rest] = parts;
    switch (table) {
        case 'limits': {
            if (rest.length === 1) {
                const entry = policy.limits?.root[rest[0]!];
                return entry ? plain(entry) : undefined;
            }
            const entry = policy.limits?.groups[rest[0]!]?.[rest[1]!];
            return entry ? plain(entry) : undefined;
        }
        case 'naming': {
            const naming = policy.naming;
            if (!naming) return undefined;
            if (rest.length === 1) {
                const value = (naming as unknown as Record<string, unknown>)[rest[0]!];
                return value === undefined ? undefined : { value };
            }
            const language = naming.languages[rest[0]!];
            if (!language) return undefined;
            if (rest.length === 2) {
                const value = (language as unknown as Record<string, unknown>)[rest[1]!];
                return value === undefined ? undefined : plain(value);
            }
            const value = (language.categories[rest[1]!] as unknown as Record<string, unknown> | undefined)?.[rest[2]!];
            return value === undefined ? undefined : plain(value);
        }
        case 'tools': {
            const tool = policy.tools?.[rest[0]!];
            if (!tool) return undefined;
            let current: unknown = tool;
            for (const part of rest.slice(1)) {
                if (typeof current !== 'object' || current === null) return undefined;
                current = (current as Record<string, unknown>)[part];
            }
            return current === undefined ? undefined : plain(current);
        }
        default: {
            let current: unknown = (policy as unknown as Record<string, unknown>)[table!];
            for (const part of rest) {
                if (typeof current !== 'object' || current === null) return undefined;
                current = (current as Record<string, unknown>)[part];
            }
            return current === undefined ? undefined : plain(current);
        }
    }
}

/** Resolves one key: preset default, root table, scope table. Lists append and deduplicate; scalars replace. */
export function resolveSetting(
    surface: SettingsSurface,
    policy: Policy,
    key: string,
    scope?: string,
): ResolvedSetting | undefined {
    const match = specFor(surface, key);
    if (!match) return undefined;
    const { spec } = match;
    const shipped = surface.defaults.get(spec.name) ?? surface.defaults.get(key);
    let value: unknown = shipped?.value;
    let source = shipped ? `preset ${shipped.preset}` : 'unset';
    let reason: string | undefined;
    const layers: { table: Partial<Policy>; name: string }[] = [{ table: policy, name: 'gspot.toml' }];
    if (scope && policy.scopeTables[scope])
        layers.push({ table: policy.scopeTables[scope]!, name: `[[scope]] ${scope}` });
    const candidates = match.language ? [spec.name, key] : [key];
    for (const layer of layers) {
        for (const candidate of candidates) {
            const found = policyValue(layer.table, candidate);
            if (!found) continue;
            if (spec.kind === 'list' && Array.isArray(value) && Array.isArray(found.value))
                value = [...new Set([...(value as unknown[]), ...(found.value as unknown[])])];
            else value = found.value;
            source = candidate === key ? layer.name : `${layer.name} (${candidate})`;
            reason = found.reason;
        }
    }
    return { key, spec, value, source, ...(reason !== undefined ? { reason } : {}), ...(scope ? { scope } : {}) };
}

/** Every setting the surface exposes, resolved, for doctor --settings and the docs. */
export function listSettings(surface: SettingsSurface, policy: Policy, scope?: string): ResolvedSetting[] {
    const rows: ResolvedSetting[] = [];
    for (const key of [...surface.specs.keys()].sort()) {
        const resolved = resolveSetting(surface, policy, key, scope);
        if (resolved) rows.push(resolved);
    }
    return rows;
}

function writtenKeys(policy: Partial<Policy>, prefix = ''): string[] {
    const keys: string[] = [];
    const push = (key: string) => keys.push(prefix + key);
    if (policy.limits) {
        for (const key of Object.keys(policy.limits.root)) push(`limits.${key}`);
        for (const [group, table] of Object.entries(policy.limits.groups))
            for (const key of Object.keys(table)) push(`limits.${group}.${key}`);
    }
    if (policy.naming) {
        for (const [language, table] of Object.entries(policy.naming.languages)) {
            for (const key of ['max_chars', 'max_words', 'case'] as const)
                if (table[key] !== undefined) push(`naming.${language}.${key}`);
            for (const [category, inner] of Object.entries(table.categories))
                for (const key of ['max_chars', 'max_words', 'case'] as const)
                    if (inner[key] !== undefined) push(`naming.${language}.${category}.${key}`);
        }
    }
    if (policy.tools) {
        for (const [tool, table] of Object.entries(policy.tools))
            for (const slot of Object.keys(table))
                if (slot !== 'extra' && slot !== 'enabled') push(`tools.${tool}.${slot}`);
    }
    if (policy.format) for (const key of Object.keys(policy.format)) push(`format.${key}`);
    return keys;
}

/** Validates every written key against the surface and the loosening rule. Returns problems in plain English. */
export function validateAgainstSurface(surface: SettingsSurface, policy: Policy): string[] {
    const problems = [...surface.problems];
    const scopes: { table: Partial<Policy>; scope?: string }[] = [
        { table: policy },
        ...Object.entries(policy.scopeTables).map(([scope, table]) => ({ table, scope })),
    ];
    for (const { table, scope } of scopes) {
        for (const key of writtenKeys(table)) {
            const match = specFor(surface, key);
            if (!match) {
                const prefix = key
                    .split('.')
                    .slice(0, key.startsWith('tools.') ? 2 : 1)
                    .join('.');
                const known = [...surface.specs.keys()]
                    .filter((candidate) => candidate.startsWith(`${prefix}.`))
                    .map((candidate) => candidate.slice(prefix.length + 1));
                if (key.startsWith('limits.'))
                    problems.push(
                        messages.limitUnknown(
                            key,
                            [...surface.specs.keys()]
                                .filter((candidate) => candidate.startsWith('limits.'))
                                .map((candidate) => candidate.slice(7)),
                        ),
                    );
                else
                    problems.push(
                        messages.settingNotExposed(
                            key,
                            known.length > 0
                                ? nearMatches(key.slice(prefix.length + 1), known).concat(
                                      known.filter(
                                          (item) => !nearMatches(key.slice(prefix.length + 1), known).includes(item),
                                      ),
                                  )
                                : [],
                        ),
                    );
                continue;
            }
            const written = policyValue(table, key);
            if (!written) continue;
            const shipped = surface.defaults.get(match.spec.name)?.value;
            if (match.spec.kind === 'list') {
                for (const item of Array.isArray(written.value) ? (written.value as unknown[]) : []) {
                    if (typeof item !== 'object' || item === null || !('reason' in item)) continue;
                    const reason = String((item as { reason: unknown }).reason);
                    const word = (item as { word?: unknown }).word;
                    if (key === 'tools.typos.words' && reason === word) continue;
                    if (!reasonAccepted(reason)) problems.push(messages.refusedReason(key, reason));
                }
                continue;
            }
            if (isLoosening(match.spec, written.value, shipped) && !reasonAccepted(written.reason)) {
                const shown = shipped === undefined ? 'default' : `default ${JSON.stringify(shipped)}`;
                const scoped = scope ? ` --scope ${scope}` : '';
                if (written.reason !== undefined) problems.push(messages.refusedReason(key, written.reason));
                else
                    problems.push(
                        messages.loosenNeedsReason(
                            key,
                            JSON.stringify(written.value),
                            shown,
                            `gspot set ${key} ${JSON.stringify(written.value)}${scoped} --reason "..."`,
                        ),
                    );
            }
        }
        for (const [tool, toolTable] of Object.entries(table.tools ?? {})) {
            if (!toolTable.extra) continue;
            for (const key of Object.keys(toolTable.extra)) {
                if (key !== 'reason' && surface.specs.has(`tools.${tool}.${key}`))
                    problems.push(messages.extraCoversSlot(tool, key));
            }
        }
    }
    for (const group of policy.naming.remove_groups) {
        if (group.group === 'marketing' || group.group === 'defensive')
            problems.push(messages.groupNotRemovable(group.group));
    }
    return problems;
}
