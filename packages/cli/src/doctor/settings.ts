// The --settings listing: every setting, its value, and where it came from.
import { listSettings } from '#cli/policy/settings.ts';
import type { Session } from '#cli/run/session.ts';
import type { SettingRow } from '#types/doctor.ts';

/** Every setting per scope, plus every extra table under "not a slot". */
export function settingRows(session: Session): {
    rows: SettingRow[];
    extras: { tool: string; keys: string[]; reason: string; scope: string }[];
} {
    const rows: SettingRow[] = [];
    for (const selection of session.scopes) {
        for (const resolved of listSettings(selection.surface, session.loaded.policy, selection.scope.path)) {
            if (selection.scope.path !== '' && resolved.source.startsWith('preset')) continue;
            rows.push({
                key: resolved.key,
                value: resolved.value,
                source: resolved.source,
                direction: resolved.spec.direction,
                scope: selection.scope.path,
            });
        }
    }
    const extras: { tool: string; keys: string[]; reason: string; scope: string }[] = [];
    const tables: { scope: string; tools: Record<string, { extra?: Record<string, unknown> & { reason: string } }> }[] =
        [{ scope: '', tools: session.loaded.policy.tools }];
    for (const [scope, table] of Object.entries(session.loaded.policy.scopeTables))
        if (table.tools) tables.push({ scope, tools: table.tools });
    for (const { scope, tools } of tables)
        for (const [tool, table] of Object.entries(tools))
            if (table.extra)
                extras.push({
                    tool,
                    keys: Object.keys(table.extra).filter((key) => key !== 'reason'),
                    reason: table.extra.reason,
                    scope,
                });
    return { rows, extras };
}
