// The settings listing: every setting, its value, and where it came from.
import type { Session } from '#cli/run/session.ts';
import { listSettings } from '#cli/policy/settings.ts';

function rowsFor(session: Session): SettingRow[] {
    return session.scopes.flatMap((selection) => {
        const scope = selection.scope.path;
        return listSettings(selection.surface, session.policyFiles.policy, scope)
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
 * @param session the session
 * @returns the rows and the extra tables
 */
export function settingRows(session: Session): SettingsListing {
    const { policy } = session.policyFiles;
    const fromScopes = Object.entries(policy.scopeTables).flatMap(([scope, table]) =>
        table.tools === undefined ? [] : extrasFor(scope, table.tools),
    );
    return { rows: rowsFor(session), extras: [...extrasFor('', policy.tools), ...fromScopes] };
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
