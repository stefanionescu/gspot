import {
    buildUnchangedResult,
    formatConfigurationChange,
    readConfigurationEditContext,
    writeSettingsEdit,
} from '#cli/commands/edits.ts';
import { SCOPE_OPTION } from '#cli/config/commands/help.ts';
import { selectConfigurations } from '#cli/manifests/select.ts';
import { buildDetectedTables } from '#cli/settings/detected.ts';
import { overlayTable } from '#cli/settings/edit.ts';
import { getRequired, isTable } from '#cli/system/tables.ts';
import { formatNameState } from '#cli/system/text/messages.ts';
import type { CommandDefinition, ConfigurationsOptions, ScopeFlags } from '#cli/types/commands.ts';
import type { TomlTable } from '#cli/types/settings.ts';
import type { CommandResult } from '#cli/types/system.ts';

function restoreConfigurations(table: TomlTable, added: string[]): void {
    const previous = table['removed_configurations'];
    if (!isTable(previous)) return;
    const remaining = Object.entries(previous).filter(([name]) => !added.includes(name));
    if (remaining.length === 0) delete table['removed_configurations'];
    else table['removed_configurations'] = Object.fromEntries(remaining);
}

async function runAddCommand(options: ConfigurationsOptions): Promise<CommandResult> {
    const context = await readConfigurationEditContext(options, options.configurations);
    const { scopePath, scopeTable, scopeSettings, selected } = context;
    if (options.configurations.every((name) => selected.includes(name))) {
        return buildUnchangedResult(`No change: ${formatNameState(options.configurations, 'already selected')}.`);
    }
    const scopeConfigurations = scopeSettings.configurations;
    const list = [...scopeConfigurations];
    const added = options.configurations.filter((name) => !selected.includes(name));
    list.push(...added.filter((name) => !list.includes(name)));
    scopeTable['configurations'] = list;
    restoreConfigurations(scopeTable, options.configurations);
    const { repository } = context.session;
    const newlySelected = selectConfigurations(added).filter(({ name }) => !selected.includes(name));
    const detected = buildDetectedTables([{ scopePath, selected: newlySelected }], {
        repository,
        scopes: repository.scopeFolders,
    });
    overlayTable(scopeTable, getRequired(detected, scopePath, 'detected table'));
    const where = scopePath === '' ? '' : ` to scope ${scopePath}`;
    const unchanged = options.configurations.filter((name) => selected.includes(name));
    const summary = formatConfigurationChange({
        action: 'Added',
        changed: added,
        where,
        unchanged,
        state: 'already selected',
    });
    return await writeSettingsEdit(context, { summary });
}

export const ADD_COMMAND: CommandDefinition<[string[]], ScopeFlags, Omit<ConfigurationsOptions, 'root'>> = {
    name: 'add',
    arguments: [{ term: '<configuration...>' }],
    options: [{ flags: SCOPE_OPTION }],
    parse: ({ arguments: commandArguments, flags: { scope: scopePath }, cwd }) => {
        const [configurations] = commandArguments;
        return { cwd, configurations: [...new Set(configurations)], scopePath };
    },
    run: runAddCommand,
};
