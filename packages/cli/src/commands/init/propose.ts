import { stringify } from 'smol-toml';
import { asRecord } from '#cli/policy/settings.ts';
import { policySchema } from '#cli/policy/schema.ts';
import type { InitPlan } from '#cli/types/commands/init.ts';
import type { TomlTable } from '#cli/types/policy/policy.ts';
import { getIndent, wrapLongArrays } from '#cli/policy/toml/width.ts';
import { SCHEMA_LINE, PROFILE_HEAD } from '#cli/config/commands/init.ts';

const PREFACE = [
    SCHEMA_LINE,
    '',
    '# The policy of this repository under gspot. Every setting has a command that writes it:',
    '# gspot set, ignore, add, remove. Run gspot explain <anything> for what it means.',
    '',
    '',
].join('\n');

function headTables(plan: InitPlan): TomlTable {
    const document: TomlTable = {
        level: policySchema.shape.level.parse(undefined),
        kits: plan.kits,
    };
    const scopes = plan.scopes.map((scope) => ({ path: scope.path, kits: scope.kits }));
    if (scopes.length > 0) document['scope'] = scopes;
    return document;
}

// Repository keys override each tool setting without dropping profile siblings.
function mergeToolSettings(base: unknown, overrides: unknown): TomlTable {
    const tools = { ...asRecord(base) };
    for (const [tool, settings] of Object.entries(asRecord(overrides) ?? {}))
        tools[tool] = { ...asRecord(tools[tool]), ...asRecord(settings) };
    return tools;
}

// Repository settings override the same profile setting, without dropping other settings of that tool.
function mergeProfile(document: TomlTable, tables: TomlTable | undefined): void {
    const entries = Object.entries(tables ?? {}).filter(([key]) => !PROFILE_HEAD.has(key));
    for (const [key, value] of entries) {
        const existing = document[key];
        if (key === 'tools') {
            document[key] = mergeToolSettings(value, existing);
            continue;
        }
        const isBothTables =
            Object.keys(asRecord(existing) ?? {}).length > 0 && Object.keys(asRecord(value) ?? {}).length > 0;
        document[key] = isBothTables ? { ...asRecord(value), ...asRecord(existing) } : value;
    }
}

// Initialization selects enabled integrations.
function applyIntegrations(document: TomlTable, plan: InitPlan): void {
    if (plan.hooks === 'none') delete document['hooks'];
    else document['hooks'] = { ...asRecord(document['hooks']) };
    if (plan.ci === 'none') delete document['ci'];
    else document['ci'] = { ...asRecord(document['ci']), provider: plan.ci };
    document['rules'] = { path: '.gspot/rules', ...asRecord(document['rules']), install: plan.rules };
    if (plan.runner === 'none') delete document['runner'];
    else document['runner'] = plan.runner;
}

// The policy body, with arrays in the layout the TOML formatter keeps, so the first format check of the policy passes.
function bodyText(document: TomlTable): string {
    const tight = stringify(document).replaceAll(/= \[ (?<items>[^\n]*) \]$/gmu, '= [$<items>]');
    const seed = tight.endsWith('\n') ? tight : `${tight}\n`;
    return wrapLongArrays(seed, getIndent(document));
}

/**
 * The gspot.toml text for a plan.
 * @param plan the plan
 * @returns the TOML text with the schema line and the preface
 */
export function proposeText(plan: InitPlan): string {
    const document = headTables(plan);
    if (plan.commitScopes !== undefined && plan.commitScopes.length > 0)
        document['tools'] = { commitlint: { scopes: plan.commitScopes } };
    mergeProfile(document, plan.profileTables);
    applyIntegrations(document, plan);
    return `${PREFACE}${bodyText(document)}`;
}
