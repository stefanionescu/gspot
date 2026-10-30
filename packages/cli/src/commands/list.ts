import { ROOT_RUNS } from '#cli/config/planning.ts';
import type { Session } from '#cli/types/session.ts';
import { openSession } from '#cli/planning/session.ts';
import { isRootOnlyCheck } from '#cli/planning/files.ts';
import { ROOT_SCOPE_LABEL } from '#cli/config/terminal.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { readRepositoryRoot } from '#cli/repository/read.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import { isActive, planChecks } from '#cli/planning/checks.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import type { Settings } from '#cli/types/settings/settings.ts';
import { listInheritedSettings } from '#cli/settings/inherit.ts';
import { listRemovedConfigurations } from '#cli/settings/scopes.ts';
import { Argument, type Command } from '@commander-js/extra-typings';
import { listSelectedConfigurations } from '#cli/manifests/select.ts';
import type { CommandResult, CommandCompletion } from '#cli/types/terminal.ts';
import type { ListKind, SettingsListJson, ConfigurationsListJson } from '#cli/types/commands/commands.ts';

import {
    KEY_GAP,
    LIST_USAGE,
    LIST_KINDS,
    VALUE_WIDTH,
    OFF_BY_LEVEL,
    REASON_HEADER,
    NO_MATCHING_FILES,
} from '#cli/config/commands/commands.ts';

function buildSettingsResult(session: Session): CommandResult {
    const settings = buildSettingRows(session.settings, session.scopes);
    const displayed = settings.filter(
        (row) => row.scope === '' || (row.origin === 'scope' && row.originScope === row.scope),
    );
    const width = Math.max(...displayed.map((row) => row.key.length)) + KEY_GAP;
    const lines = displayed.map((row) => {
        const value = row.value === undefined ? 'unset' : JSON.stringify(row.value);
        const shortened = value.length > VALUE_WIDTH ? `${value.slice(0, VALUE_WIDTH - 1)}…` : value;
        const scope = row.scope === '' ? '' : `  [scope ${row.scope}]`;
        return `${row.key.padEnd(width)}${shortened.padEnd(VALUE_WIDTH)} ${(row.reason_when ?? '').padEnd(REASON_HEADER.length)}  ${row.source}${scope}`;
    });
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
            const path =
                (ROOT_RUNS as readonly string[]).includes(check.runs) || isRootOnlyCheck(configuration, check)
                    ? ''
                    : scope.path;
            const key = `${path}\0${check.id}`;
            if (listed.has(key)) return [];
            listed.add(key);
            const state = formatCheckState(planned.get(path)?.findLast((each) => each.check.id === check.id));
            return [{ name: check.id, scope: path, state }];
        });
    });
}

function buildConfigurationsResult(session: Session): CommandResult {
    const configurations = listSelectedConfigurations(session.scopes);
    const names = new Set(configurations.map((configuration) => configuration.name));
    const planned = Map.groupBy(planChecks(session, { stage: 'any' }), (check) => check.scope.path);
    const selected = configurations.map((configuration) => ({
        name: configuration.name,
        checks: listCheckStates(session, configuration, planned),
    }));
    const available = session.configurationsByName
        .values()
        .filter((configuration) => !names.has(configuration.name))
        .map((configuration) => ({ name: configuration.name, description: configuration.description }))
        .toArray();
    const lines = ['selected'];
    for (const configuration of selected) {
        lines.push(`  ${configuration.name}`);
        const groups = Map.groupBy(configuration.checks, (check) => check.name);
        for (const [name, checks] of groups) {
            const states = checks.map(
                (check) => `${check.scope === '' ? ROOT_SCOPE_LABEL : check.scope}: ${check.state}`,
            );
            lines.push(`    ${name}  ${states.join(', ')}`);
        }
    }
    const removed = listRemovedConfigurations(session.settings);
    if (removed.length > 0) lines.push('', 'removed');
    for (const { name, scope, reason } of removed)
        lines.push(['', name, ...(scope === '' ? [] : [`[scope ${scope}]`]), reason].join('  '));
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
        return listInheritedSettings(scope.availableSettings, settings, scopePath)
            .filter((setting) => scopePath === '' || setting.origin !== 'configuration')
            .map((row) => ({
                key: row.key,
                value: row.value,
                source: row.source,
                origin: row.origin,
                originScope: row.originScope,
                reason_when: row.setting.reason_when,
                scope: scopePath,
            }));
    });
}

function formatCheckState(planned: PlannedCheck | undefined): string {
    if (planned === undefined) return OFF_BY_LEVEL;
    if (planned.skip !== undefined) return `off (${planned.skip.cause})`;
    return isActive(planned) ? 'on' : NO_MATCHING_FILES;
}

async function runListCommand(cwd: string, kind: ListKind): Promise<CommandResult> {
    const root = await readRepositoryRoot(cwd);

    const session = await openSession(root);
    return kind === 'settings' ? buildSettingsResult(session) : buildConfigurationsResult(session);
}

/**
Register the list command.

@param program the gspot program that gets the command.
@param onResult receives the result of the command.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: main.ts registers the command through it, like every other command.
export function registerList(program: Command, onResult: CommandCompletion): void {
    program
        .command('list')
        .usage(LIST_USAGE)
        .summary(COMMAND_HELP.list.summary)
        .description(COMMAND_HELP.list.description)
        .addArgument(
            new Argument('[kind]', COMMAND_HELP.list.arguments.kind).choices(LIST_KINDS).default('configurations'),
        )
        .action(async (kind) => {
            onResult(await runListCommand(process.cwd(), kind));
        });
}
