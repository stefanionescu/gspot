// The --settings listing: every setting, its value, and where it came from.
import type { Session } from '#types/run.ts';
import { listSettings } from '#cli/policy/settings.ts';
import type { ExtraRow, SettingRow, SettingsListing, ToolTables } from '#types/doctor.ts';

function rowsFor(session: Session): SettingRow[] {
    return session.scopes.flatMap((selection) => {
        const scope = selection.scope.path;
        return listSettings(selection.surface, session.policyFiles.policy, scope)
            .filter((entry) => scope === '' || !entry.source.startsWith('preset'))
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
                reason: table.extra.reason,
                scope,
            },
        ];
    });
}

/**
 * Every setting per scope, plus every extra table under "not a slot".
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
