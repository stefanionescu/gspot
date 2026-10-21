import { openSession } from '#cli/session.ts';
import { findRoot } from '#cli/repository/read.ts';
import { stripUndefined } from '#cli/system/values.ts';
import { listSettings } from '#cli/settings/inherit.ts';
import { formatScopeLabel } from '#cli/system/terminal.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { planRun, isActive } from '#cli/planning/checks.ts';
import { Argument, type Command } from '@commander-js/extra-typings';
import { listSelectedManifests } from '#cli/configurations/select.ts';
import { type Session, type PlannedCheck } from '#cli/types/planning.ts';
import { KEY_GAP, LIST_KINDS, VALUE_WIDTH } from '#cli/config/commands/list.ts';
import { type Settings, type ScopeSelection } from '#cli/types/settings/values.ts';
import { type CommandResult, type CommandCompletion } from '#cli/types/terminal.ts';
import { type ListKind, type SettingsListJson, type ConfigurationsListJson } from '#cli/types/commands/list.ts';

function formatScopeTag(scope: string): string {
    return scope === '' ? '' : `  [scope ${scope}]`;
}

function buildSettingsResult(session: Session): CommandResult {
    const { settings: rows } = buildSettingRows(session.settingsFile.settings, session.scopes);
    const displayed = rows.filter(
        (row) => row.scope === '' || (row.origin === 'scope' && row.originScope === row.scope),
    );
    const width = Math.max(...displayed.map((row) => row.key.length)) + KEY_GAP;
    const lines = displayed.map((row) => {
        const value = row.value === undefined ? 'unset' : JSON.stringify(row.value);
        const shortened = value.length > VALUE_WIDTH ? `${value.slice(0, VALUE_WIDTH - 1)}…` : value;
        return `${row.key.padEnd(width)}${shortened.padEnd(VALUE_WIDTH)} ${(row.reason_needed ?? '').padEnd('reason needed when'.length)}  ${row.source}${formatScopeTag(row.scope)}`;
    });
    lines.unshift(`${'setting'.padEnd(width)}${'value'.padEnd(VALUE_WIDTH)} reason needed when  source`);
    return { text: `${lines.join('\n')}\n`, json: { settings: rows } satisfies SettingsListJson, exitCode: 0 };
}

function buildConfigurationsResult(session: Session): CommandResult {
    const manifests = listSelectedManifests(session.scopes);
    const names = new Set(manifests.map((manifest) => manifest.configuration.name));
    const planned = new Map(
        planRun(session, { stage: 'any' }).map((check) => [
            `${check.selection.scope.path}\0${check.check.name}`,
            check,
        ]),
    );
    const selected = manifests.map((manifest) => ({
        name: manifest.configuration.name,
        checks: session.scopes.flatMap((selection) =>
            selection.selected.includes(manifest)
                ? manifest.checks.map((check) => ({
                      name: check.name,
                      scope: selection.scope.path,
                      state: formatCheckStatus(planned.get(`${selection.scope.path}\0${check.name}`)),
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
            const states = checks.map((check) => `${formatScopeLabel(check.scope)}: ${check.state}`);
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
 * List every setting for each scope.
 *
 * @param settings the parsed gspot.toml.
 * @param scopes the settings that apply in each scope.
 * @returns values and their inheritance sources for every selected scope.
 */
function buildSettingRows(settings: Settings, scopes: ScopeSelection[]): SettingsListJson {
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
    return { settings: rows };
}

function formatCheckStatus(check: PlannedCheck | undefined): string {
    if (check === undefined) return 'off (level)';
    if (check.skip !== undefined) return `off (${check.skip.cause})`;
    return isActive(check) ? 'on' : 'no matching files';
}

/**
 * Register the list command. It runs no checks and changes no files.
 *
 * @param program the CLI that gets the command.
 * @param onResult writes the command result.
 */
function registerList(program: Command, onResult: CommandCompletion): void {
    program
        .command('list')
        .usage('[options] [configurations|settings]')
        .summary(COMMAND_HELP.list.summary)
        .description(COMMAND_HELP.list.description)
        .addArgument(
            new Argument('[what]', COMMAND_HELP.list.arguments.what).choices(LIST_KINDS).default('configurations'),
        )
        .action(async (kind) => {
            onResult(await runListCommand(process.cwd(), kind));
        });
}

/**
 * Run the list command and return its output.
 *
 * @param cwd the folder where the command starts.
 * @param kind whether to list configurations or settings.
 * @returns the list and its exit code.
 */
async function runListCommand(cwd: string, kind: ListKind): Promise<CommandResult> {
    const root = findRoot(cwd);

    const session = await openSession(root);
    return kind === 'settings' ? buildSettingsResult(session) : buildConfigurationsResult(session);
}

export { registerList };
