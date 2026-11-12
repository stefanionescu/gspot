import {
    KEY_GAP,
    LIST_ARGUMENT,
    LIST_KINDS,
    NOT_SET,
    REASON_HEADER,
    VALUE_WIDTH,
} from '#cli/config/commands/reports.ts';
import { isRepositoryRun, isRootOnlyCheck } from '#cli/engine/files.ts';
import { buildCheckState, planChecks } from '#cli/engine/plan.ts';
import { openSession } from '#cli/engine/session.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { listSelectedConfigurations } from '#cli/manifests/select.ts';
import { formatSettingSource, listInheritedSettings } from '#cli/settings/inherit.ts';
import { findSettingSchema } from '#cli/settings/lookup.ts';
import { listRemovedConfigurations } from '#cli/settings/scopes.ts';
import { isTable } from '#cli/system/tables.ts';
import { formatCount, formatScope } from '#cli/system/text.ts';
import type { CommandDefinition, ConfigurationsListJson, SettingsListJson } from '#cli/types/commands.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import type { Scope, Settings } from '#cli/types/settings.ts';
import type { CommandResult } from '#cli/types/system.ts';
import type { Session } from '#cli/types/tools.ts';

const SCOPES_NAMED = 3;

const REASON_CONDITIONS = { adding: 'you add items', lowering: 'you lower it', raising: 'you raise it' } as const;

function formatScopeGroup(scopes: readonly string[]): string {
    const nested = scopes.filter((scopePath) => scopePath !== '');
    const named = nested.length === 1 ? formatScope(nested[0] as string) : formatCount(nested.length, 'scope');
    if (nested.length === 0) return formatScope('');
    return nested.length === scopes.length ? named : `${formatScope('')} and ${named}`;
}

/**
List the lines of one value. Each record of a record list takes its own line, because one line of several records
is too long to read.
*/
function formatValueLines(value: unknown): string[] {
    if (value === undefined) return [NOT_SET];
    if (Array.isArray(value) && value.length > 0 && value.every((record) => isTable(record)))
        return value.map((record) => JSON.stringify(record));
    return [JSON.stringify(value)];
}

function buildSettingsResult(session: Session): CommandResult {
    const settings = buildSettingRows(session.settings, session.scopes);
    const groups = Map.groupBy(settings, ({ setting, value, reasonFor, source }) =>
        JSON.stringify([setting, value, reasonFor, source]),
    );
    const width = Math.max(...settings.map((row) => row.setting.length)) + KEY_GAP;
    const lines = groups
        .values()
        .flatMap((rows) => {
            const [row] = rows as [(typeof settings)[number]];
            const values = formatValueLines(row.value);
            const [first] = values as [string];
            const isInline = values.length === 1 && first.length <= VALUE_WIDTH;
            const where = session.scopes.length === 1 ? '' : `  in ${formatScopeGroup(rows.map(({ scope }) => scope))}`;
            const condition = row.reasonFor === undefined ? '' : REASON_CONDITIONS[row.reasonFor];
            return [
                `${row.setting.padEnd(width)}${(isInline ? first : '').padEnd(VALUE_WIDTH)} ${condition.padEnd(REASON_HEADER.length)}  ${formatSettingSource(row.source)}${where}`,
                ...(isInline ? [] : values.map((value) => `${''.padEnd(width)}${value}`)),
            ];
        })
        .toArray();
    lines.unshift(`${'setting'.padEnd(width)}${'value'.padEnd(VALUE_WIDTH)} ${REASON_HEADER}  source`);
    return { text: `${lines.join('\n')}\n`, json: { settings } satisfies SettingsListJson, exitCode: 0 };
}

function listCheckStates(
    session: Session,
    configuration: Configuration,
    planned: Map<string, PlannedCheck[]>,
): ConfigurationsListJson['selected'][number]['checks'] {
    const listed = new Set<string>();
    return session.scopes.flatMap((scope) => {
        if (!scope.configurations.includes(configuration)) return [];
        return configuration.checks.flatMap((check) => {
            const path = isRepositoryRun(check) || isRootOnlyCheck(configuration, check) ? '' : scope.path;
            const key = `${path}\0${check.id}`;
            if (listed.has(key)) return [];
            listed.add(key);
            const state = buildCheckState(planned.get(path)?.findLast((each) => each.check.id === check.id));
            return [{ check: check.id, scope: path, ...state }];
        });
    });
}

function formatCheckStates(checks: ConfigurationsListJson['selected'][number]['checks']): string {
    const states = [...Map.groupBy(checks, (state) => (state.status === 'on' ? 'on' : `skipped (${state.cause})`))];
    const [only] = states as [[string, typeof checks]];
    if (states.length > 1)
        return states
            .map(([status, group]) => {
                const scopes = group.map(({ scope }) => scope);
                const place =
                    scopes.length > SCOPES_NAMED
                        ? formatScopeGroup(scopes)
                        : scopes.map((scope) => formatScope(scope)).join(', ');
                return `${status} in ${place}`;
            })
            .join('; ');
    return checks.length === 1 ? only[0] : `${only[0]} in ${formatScopeGroup(checks.map(({ scope }) => scope))}`;
}

function buildConfigurationsResult(session: Session): CommandResult {
    const configurations = listSelectedConfigurations(session.scopes);
    const names = new Set(configurations.map((configuration) => configuration.name));
    const planned = Map.groupBy(planChecks(session, { stage: 'any', keepLevelOff: true }), (check) => check.scope.path);
    const selected = configurations.map((configuration) => ({
        name: configuration.name,
        checks: listCheckStates(session, configuration, planned),
    }));
    const available = readConfigurations()
        .values()
        .filter((configuration) => !names.has(configuration.name))
        .map((configuration) => ({ name: configuration.name, description: configuration.description }))
        .toArray();
    const lines = ['selected'];
    for (const configuration of selected) {
        lines.push(`  ${configuration.name}`);
        const groups = Map.groupBy(configuration.checks, ({ check }) => check);
        for (const [name, checks] of groups) lines.push(`    ${name}  ${formatCheckStates(checks)}`);
    }
    const removed = listRemovedConfigurations(session.settings);
    if (removed.length > 0) lines.push('', 'removed');
    for (const { name, scope, reason } of removed)
        lines.push(['', name, ...(scope === '' ? [] : [`scope ${scope}`]), reason].join('  '));
    lines.push('', 'available');
    for (const configuration of available) lines.push(`  ${configuration.name}  ${configuration.description}`);
    return {
        text: `${lines.join('\n')}\n`,
        json: { selected, removed, available } satisfies ConfigurationsListJson,
        exitCode: 0,
    };
}

function buildSettingRows(settings: Settings, scopes: Scope[]): SettingsListJson['settings'] {
    return scopes.flatMap((scope) => {
        const scopePath = scope.path;
        const rows = listInheritedSettings(scope.availableSettings, settings, scopePath);
        return rows
            .filter(({ key }) => findSettingSchema(key) !== undefined)
            .map((row) => ({
                setting: row.key,
                value: row.value,
                source: row.origin,
                reasonFor: row.setting.reason_for,
                scope: scopePath,
            }));
    });
}

export const LIST_COMMAND: CommandDefinition<[(typeof LIST_KINDS)[number]]> = {
    name: 'list',
    arguments: [{ term: LIST_ARGUMENT, choices: LIST_KINDS, defaultValue: 'configurations' }],
    run: async ({ arguments: commandArguments, root }) => {
        const [kind] = commandArguments;
        const session = await openSession(root);
        return kind === 'settings' ? buildSettingsResult(session) : buildConfigurationsResult(session);
    },
};
