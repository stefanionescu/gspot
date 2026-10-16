import { findRoot } from '#cli/repository/read.ts';
import { settingsSkip } from '#cli/planning/skips.ts';
import { printResult } from '#cli/system/terminal.ts';
import { type Session } from '#cli/types/planning.ts';
import { openSession } from '#cli/commands/session.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { type CommandResult } from '#cli/types/terminal.ts';
import { assertVersionPin } from '#cli/apply/version-pin.ts';
import { isRecord, stripUndefined } from '#cli/system/values.ts';
import { Argument, type Command } from '@commander-js/extra-typings';
import { listSelectedManifests } from '#cli/configurations/select.ts';
import { KEY_GAP, LIST_KINDS, VALUE_WIDTH } from '#cli/config/commands/list.ts';
import { type Settings, type ScopeSelection } from '#cli/types/settings/values.ts';
import { everyTable, listSettings, writtenSetting } from '#cli/settings/inherit.ts';
import { type SettingsListJson, type ConfigurationsListJson } from '#cli/types/commands/list.ts';

function scopeTag(scope: string | undefined): string {
    return scope === undefined || scope === '' ? '' : `  [scope ${scope}]`;
}

function buildSettingsResult(session: Session): CommandResult {
    const { settings: rows, extras } = buildSettingRows(session.settingsFile.settings, session.scopes);
    const displayed = rows.filter(
        (row) => row.scope === '' || (row.origin === 'scope' && row.originScope === row.scope),
    );
    const width = Math.max(...displayed.map((row) => row.key.length)) + KEY_GAP;
    const lines = displayed.map((row) => {
        const value = row.value === undefined ? 'unset' : JSON.stringify(row.value);
        const shortened = value.length > VALUE_WIDTH ? `${value.slice(0, VALUE_WIDTH - 1)}…` : value;
        return `${row.key.padEnd(width)}${shortened.padEnd(VALUE_WIDTH)} ${row.reason_needed ?? ''}  ${row.source}${scopeTag(row.scope)}`;
    });
    if (extras.length > 0) {
        lines.push('', 'extra tool options (gspot passes them on unchecked)');
        for (const extra of extras)
            lines.push(
                `  tools.${extra.tool}.extra  ${extra.keys.join(', ')}  ${extra.reason ?? ''}${scopeTag(extra.scope)}`,
            );
    }
    return { text: `${lines.join('\n')}\n`, json: { settings: rows, extras } satisfies SettingsListJson, exitCode: 0 };
}

function buildConfigurationsResult(session: Session): CommandResult {
    const manifests = listSelectedManifests(session.scopes);
    const names = new Set(manifests.map((manifest) => manifest.configuration.name));
    const selected = manifests.map((manifest) => ({
        name: manifest.configuration.name,
        checks: session.scopes.flatMap((scope) =>
            scope.selected.includes(manifest)
                ? manifest.checks.map((check) => ({
                      name: check.name,
                      scope: scope.scope.path,
                      state: statusLabel(settingsSkip(session.settingsFile.settings, scope, check)),
                  }))
                : [],
        ),
    }));
    const available = session.manifests
        .values()
        .filter((manifest) => !names.has(manifest.configuration.name))
        .map((manifest) => ({ name: manifest.configuration.name, description: manifest.configuration.description }))
        .toArray();
    const lines = ['selected'];
    for (const configuration of selected) {
        lines.push(`  ${configuration.name}`);
        for (const [name, checks] of Map.groupBy(configuration.checks, (check) => check.name)) {
            const states = checks.map((check) => `${check.scope === '' ? 'root' : check.scope}: ${check.state}`);
            lines.push(`    ${name}  ${states.join(', ')}`);
        }
    }
    lines.push('', 'available');
    for (const configuration of available) lines.push(`  ${configuration.name}  ${configuration.description}`);
    return {
        text: `${lines.join('\n')}\n`,
        json: { selected, available } satisfies ConfigurationsListJson,
        exitCode: 0,
    };
}

/**
 * Every setting per scope, plus each written extra tool options table.
 * @param settings the parsed repository settings
 * @param scopes the effective settings for each scope
 * @returns the rows and the extra tables
 */
function buildSettingRows(settings: Settings, scopes: ScopeSelection[]): SettingsListJson {
    const extras = everyTable(settings).flatMap(({ table, scope = '' }) =>
        (table.tools === undefined ? [] : Object.entries(table.tools)).flatMap(([tool, { extra }]) =>
            isRecord(extra)
                ? [
                      stripUndefined({
                          tool,
                          keys: Object.keys(extra),
                          reason: writtenSetting(table, `tools.${tool}.extra`)?.reason,
                          scope,
                      }),
                  ]
                : [],
        ),
    );
    const rows = scopes.flatMap((selection) => {
        const scope = selection.scope.path;
        return listSettings(selection.known, settings, scope)
            .filter((entry) => scope === '' || entry.origin !== 'configuration')
            .map((entry) => ({
                key: entry.key,
                value: entry.value,
                source: entry.source,
                origin: entry.origin,
                ...stripUndefined({ originScope: entry.originScope }),
                reason_needed: entry.declaration.reason_needed,
                scope,
            }));
    });
    return { settings: rows, extras };
}

function statusLabel(status: ReturnType<typeof settingsSkip>): string {
    if (status === undefined) return 'on';
    return status.cause === 'setting' ? `waits for ${status.setting}` : `off (${status.cause})`;
}

/**
 * List configurations and effective settings without executing checks or mutating the project.
 * @param program the command-line program
 */
export function registerList(program: Command): void {
    program
        .command('list')
        .summary(COMMAND_HELP.list.summary)
        .description(COMMAND_HELP.list.description)
        .addArgument(
            new Argument('[what]', COMMAND_HELP.list.arguments.what).choices(LIST_KINDS).default('configurations'),
        )
        .action(async (kind) => {
            const root = findRoot(process.cwd());
            await assertVersionPin(root);
            const session = await openSession(root);
            printResult(kind === 'settings' ? buildSettingsResult(session) : buildConfigurationsResult(session));
        });
}
