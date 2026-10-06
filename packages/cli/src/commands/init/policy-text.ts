import { stringify } from 'smol-toml';
import { isRecord } from '#cli/platform/objects.ts';
import { policySchema } from '#cli/policy/schema/policy.ts';
import { policyIndent } from '#cli/policy/settings/known.ts';
import { wrapLongArrays } from '#cli/parsers/toml/layout.ts';
import { POLICY_LINE_WIDTH } from '#cli/config/parsers/toml.ts';
import { RULES_DIRECTORY } from '#cli/config/platform/locations.ts';
import { PREFACE, TEMPLATE_HEAD } from '#cli/config/commands/init.ts';
import type { InitSelection } from '#cli/types/lifecycle/selection.ts';
import type { RawPolicy, TomlTable } from '#cli/types/policy/settings.ts';
import type { InitAnswers, PolicyDraft } from '#cli/types/commands/init.ts';

function headTables(draft: PolicyDraft): TomlTable {
    const document: TomlTable = {
        level: policySchema.shape.level.parse(undefined),
        configurations: draft.configurations,
    };
    const scopes = draft.scopes.map((scope) => ({ path: scope.path, configurations: scope.configurations }));
    if (scopes.length > 0) document['scope'] = scopes;
    return document;
}

// Repository keys override each tool setting without dropping template siblings.
function mergeToolSettings(base: unknown, overrides: unknown): TomlTable {
    const tools = { ...(isRecord(base) ? base : {}) };
    for (const [tool, settings] of Object.entries(isRecord(overrides) ? overrides : {})) {
        const original = tools[tool];
        tools[tool] = { ...(isRecord(original) ? original : {}), ...(isRecord(settings) ? settings : {}) };
    }
    return tools;
}

// Repository settings override the same template setting, without dropping other settings of that tool.
function mergeTemplate(document: TomlTable, tables: TomlTable | undefined): void {
    const entries = (tables === undefined ? [] : Object.entries(tables)).filter(([key]) => !TEMPLATE_HEAD.has(key));
    for (const [key, value] of entries) {
        const existing = document[key];
        if (key === 'tools') {
            document[key] = mergeToolSettings(value, existing);
            continue;
        }
        const isBothTables =
            isRecord(existing) && isRecord(value) && Object.keys(existing).length > 0 && Object.keys(value).length > 0;
        document[key] = isBothTables ? { ...value, ...existing } : value;
    }
}

// Writes the hooks, CI, agent rules, and runner tables from the answers.
function applyIntegrations(document: TomlTable, draft: PolicyDraft): void {
    const { hooks, ci, agent_rules: agentRules } = document as Partial<Pick<RawPolicy, 'hooks' | 'ci' | 'agent_rules'>>;
    if (draft.hooks) {
        document['hooks'] = { ...hooks };
    } else {
        delete document['hooks'];
    }
    if (draft.ci === 'none') delete document['ci'];
    else document['ci'] = { ...ci, provider: draft.ci };
    document['agent_rules'] = {
        folder: RULES_DIRECTORY,
        ...agentRules,
        enabled: draft.rules,
    };
    if (draft.runner === 'none') delete document['run_with'];
    else document['run_with'] = draft.runner;
}

// The policy body, with arrays in the layout the TOML formatter keeps, so the first format check of the policy passes.
function bodyText(document: TomlTable): string {
    const tight = stringify(document).replaceAll(/= \[ (?<items>[^\n]*) \]$/gmu, '= [$<items>]');
    const seed = tight.endsWith('\n') ? tight : `${tight}\n`;
    return wrapLongArrays(seed, { indent: policyIndent(document), width: POLICY_LINE_WIDTH });
}

/**
 * Drafts the repository policy from configuration choices and initialization answers.
 * @param selection the selected configurations and scopes
 * @param answers the integration choices
 * @returns the policy draft
 */
export function draftPolicy(selection: InitSelection, answers: InitAnswers): PolicyDraft {
    const scopes = selection.scopes.filter((scope) => scope.path !== '');
    const commitScopes =
        scopes.length > 0 && selection.selectedIds.has('commits')
            ? [...scopes.map((scope) => scope.name), 'root', 'hooks', 'deps']
            : undefined;
    return {
        configurations: selection.rootIds,
        scopes: scopes.map((scope) => ({
            path: scope.path,
            configurations: selection.scopeConfigurations.get(scope.path) ?? [],
        })),
        hooks: answers.hooks,
        ci: answers.ci,
        rules: answers.rules,
        runner: answers.runner,
        ...(commitScopes === undefined ? {} : { commitScopes }),
    };
}

/**
 * The gspot.toml text for a policy draft.
 * @param draft the policy choices
 * @returns the TOML text with the schema line and the preface
 */
export function proposeText(draft: PolicyDraft): string {
    const document = headTables(draft);
    if (draft.commitScopes !== undefined && draft.commitScopes.length > 0)
        document['tools'] = { commitlint: { scopes: draft.commitScopes } };
    mergeTemplate(document, draft.templateTables);
    applyIntegrations(document, draft);
    return `${PREFACE}${bodyText(document)}`;
}
