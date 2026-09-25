import type { Policy } from '#cli/policy/normalize.ts';
import type { ScopeSelection } from '#cli/policy/resolve.ts';
import { listSettings } from '#cli/policy/settings.ts';

function rowsFor(policy: Policy, scopes: ScopeSelection[]): SettingRow[] {
    return scopes.flatMap((selection) => {
        const scope = selection.scope.path;
        return listSettings(selection.surface, policy, scope)
            .filter((entry) => scope === '' || !entry.source.startsWith('configuration'))
            .map((entry) => ({
                key: entry.key,
                value: entry.value,
                source: entry.source,
                direction: entry.spec.direction,
                scope,
            }));
    });
}

function extrasFor(scope: string, tools: ToolTables): ExtraRow[] {
    return Object.entries(tools).flatMap(([tool, table]) => {
        if (table.extra === undefined) return [];
        return [
            {
                tool,
                keys: Object.keys(table.extra).filter((key) => key !== 'reason'),
                ...(table.extra.reason === undefined ? {} : { reason: table.extra.reason }),
                scope,
            },
        ];
    });
}

/**
 * Every setting per scope, plus every extra table under "not a slot."
 * @param policy the resolved policy
 * @param scopes the resolved settings for each scope
 * @returns the rows and the extra tables
 */
export function settingRows(policy: Policy, scopes: ScopeSelection[]): SettingsListing {
    const fromScopes = Object.entries(policy.scopeTables).flatMap(([scope, table]) =>
        table.tools === undefined ? [] : extrasFor(scope, table.tools),
    );
    return { rows: rowsFor(policy, scopes), extras: [...extrasFor('', policy.tools), ...fromScopes] };
}

export type SettingRow = {
    key: string;
    value: unknown;
    source: string;
    direction: string;
    scope?: string;
};

/** One `[tools.<tool>.extra]` table: the keys it sets and why. */
export type ExtraRow = { tool: string; keys: string[]; reason?: string; scope: string };

/** The settings listing. */
export type SettingsListing = { rows: SettingRow[]; extras: ExtraRow[] };

/** The `[tools.<tool>]` tables of one policy layer, as the settings listing reads them. */
export type ToolTables = Record<string, { extra?: Record<string, unknown> & { reason?: string } }>;
