import { openSession } from '#cli/session.ts';
import { findRoot } from '#cli/repository/read.ts';
import { type Session } from '#cli/types/session.ts';
import { stripUndefined } from '#cli/system/tables.ts';
import { ROOT_SCOPE_LABEL } from '#cli/config/terminal.ts';
import { type PlannedCheck } from '#cli/types/planning.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { type Settings } from '#cli/types/settings/file.ts';
import { isActive, planChecks } from '#cli/planning/checks.ts';
import { type Scope } from '#cli/types/settings/inheritance.ts';
import { listEffectiveSettings } from '#cli/settings/inherit.ts';
import { Argument, type Command } from '@commander-js/extra-typings';
import { listSelectedConfigurations } from '#cli/configurations/select.ts';
import { KEY_GAP, LIST_KINDS, VALUE_WIDTH } from '#cli/config/commands/list.ts';
import { type CommandResult, type CommandCompletion } from '#cli/types/terminal.ts';
import { type ListKind, type SettingsListJson, type ConfigurationsListJson } from '#cli/types/commands/list.ts';

function buildSettingsResult(session: Session): CommandResult {
    const { settings } = buildSettingRows(session.settingsFile.settings, session.scopes);
    const displayed = settings.filter(
        (row) => row.scope === '' || (row.origin === 'scope' && row.originScope === row.scope),
    );
    const width = Math.max(...displayed.map((row) => row.key.length)) + KEY_GAP;
    const lines = displayed.map((row) => {
        const value = row.value === undefined ? 'unset' : JSON.stringify(row.value);
        const shortened = value.length > VALUE_WIDTH ? `${value.slice(0, VALUE_WIDTH - 1)}…` : value;
        const scope = row.scope === '' ? '' : `  [scope ${row.scope}]`;
        return `${row.key.padEnd(width)}${shortened.padEnd(VALUE_WIDTH)} ${(row.reason_needed ?? '').padEnd('reason needed when'.length)}  ${row.source}${scope}`;
    });
    lines.unshift(`${'setting'.padEnd(width)}${'value'.padEnd(VALUE_WIDTH)} reason needed when  source`);
    return { text: `${lines.join('\n')}\n`, json: { settings } satisfies SettingsListJson, exitCode: 0 };
}

function buildConfigurationsResult(session: Session): CommandResult {
    const configurations = listSelectedConfigurations(session.scopes);
    const names = new Set(configurations.map((configuration) => configuration.name));
    const planned = new Map(
        planChecks(session, { stage: 'any' }).map((check) => [`${check.scope.folder.path}\0${check.check.id}`, check]),
    );
    const selected = configurations.map((configuration) => ({
        name: configuration.name,
        checks: session.scopes.flatMap((scope) =>
            scope.configurations.includes(configuration)
                ? configuration.checks.map((check) => ({
                      name: check.id,
                      scope: scope.folder.path,
                      state: formatCheckState(planned.get(`${scope.folder.path}\0${check.id}`)),
                  }))
                : [],
        ),
    }));
    const available = session.configurations
        .values()
        .filter((configuration) => !names.has(configuration.name))
        .map((configuration) => ({ name: configuration.name, description: configuration.description }))
        .toArray();
    const lines = ['selected'];
    for (const configuration of selected) {
        lines.push(`  ${configuration.name}`);
        for (const [name, checks] of Map.groupBy(configuration.checks, (check) => check.name)) {
            const states = checks.map(
                (check) => `${check.scope === '' ? ROOT_SCOPE_LABEL : check.scope}: ${check.state}`,
            );
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
function buildSettingRows(settings: Settings, scopes: Scope[]): SettingsListJson {
    const rows = scopes.flatMap((scope) => {
        const scopePath = scope.folder.path;
        return listEffectiveSettings(scope.availableSettings, settings, scopePath)
            .filter((effectiveSetting) => scopePath === '' || effectiveSetting.origin !== 'configuration')
            .map((row) => ({
                key: row.key,
                value: row.value,
                source: row.source,
                origin: row.origin,
                ...stripUndefined({ originScope: row.originScope }),
                reason_needed: row.setting.reason_needed,
                scope: scopePath,
            }));
    });
    return { settings: rows };
}

function formatCheckState(check: PlannedCheck | undefined): string {
    if (check === undefined) return 'off (level)';
    if (check.skip !== undefined) return `off (${check.skip.cause})`;
    return isActive(check) ? 'on' : 'no matching files';
}

/**
 * List the selected configurations with the state of each check, or every setting with its value and source.
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

/**
 * Register the list command. It runs no checks and changes no files.
 *
 * @param program the gspot program that gets the command.
 * @param onResult receives the result of the command.
 */
export function registerList(program: Command, onResult: CommandCompletion): void {
    program
        .command('list')
        .usage('[options] [configurations|settings]')
        .summary(COMMAND_HELP.list.summary)
        .description(COMMAND_HELP.list.description)
        .addArgument(
            new Argument('[kind]', COMMAND_HELP.list.arguments.kind).choices(LIST_KINDS).default('configurations'),
        )
        .action(async (kind) => {
            onResult(await runListCommand(process.cwd(), kind));
        });
}
