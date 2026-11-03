import { overlayTable } from '#cli/settings/edit.ts';
import { formatNameList } from '#cli/system/text.ts';
import type { TomlTable } from '#cli/types/settings.ts';
import type { CommandResult } from '#cli/types/system.ts';
import { SCOPE_OPTION } from '#cli/config/commands/help.ts';
import { stripTrailingSlashes } from '#cli/system/paths.ts';
import { isTable, getRequired } from '#cli/system/tables.ts';
import { selectConfigurations } from '#cli/manifests/select.ts';
import { buildDetectedTables } from '#cli/settings/detected.ts';
import type { ScopeFlags, CommandDefinition, ConfigurationsOptions } from '#cli/types/commands/edits.ts';

import {
    writeSettingsEdit,
    buildUnchangedResult,
    formatConfigurationChange,
    readConfigurationEditContext,
} from '#cli/commands/edits.ts';

function restoreConfigurations(table: TomlTable, added: string[]): void {
    const previous = table['removed_configurations'];
    if (!isTable(previous)) return;
    const remaining = Object.entries(previous).filter(([name]) => !added.includes(name));
    if (remaining.length === 0) delete table['removed_configurations'];
    else table['removed_configurations'] = Object.fromEntries(remaining);
}

async function runAddCommand(options: ConfigurationsOptions): Promise<CommandResult> {
    const { root, input, scope, scopeTable, scopeSettings, selected, configurationsByName, context } =
        await readConfigurationEditContext(options);
    if (options.configurations.every((name) => selected.includes(name))) {
        const verb = options.configurations.length === 1 ? 'is' : 'are';
        return buildUnchangedResult(`No change: ${formatNameList(options.configurations)} ${verb} already selected.`);
    }
    const scopeConfigurations = scopeSettings.configurations;
    const list = [...scopeConfigurations];
    const added = options.configurations.filter((name) => !selected.includes(name));
    list.push(...added.filter((name) => !list.includes(name)));
    scopeTable['configurations'] = list;
    restoreConfigurations(scopeTable, options.configurations);
    const { repository } = context.session;
    const newlySelected = selectConfigurations(added, configurationsByName).filter(
        ({ name }) => !selected.includes(name),
    );
    const detected = buildDetectedTables([{ scope, selected: newlySelected }], {
        repository,
        scopes: repository.scopeFolders,
    });
    overlayTable(scopeTable, getRequired(detected, scope, 'detected table'));
    const where = scope === '' ? '' : ` to scope ${scope}`;
    const unchanged = options.configurations.filter((name) => selected.includes(name));
    const summary = formatConfigurationChange({
        action: 'Added',
        changed: added,
        where,
        unchanged,
        state: 'already selected',
    });
    return await writeSettingsEdit(root, {
        cache: context.cache,
        listing: context.listing,
        edit: input,
        summary,
        previous: context.session,
    });
}

export const ADD_COMMAND: CommandDefinition<[string[]], ScopeFlags> = {
    name: 'add',
    arguments: [{ term: '<configuration...>' }],
    options: [{ flags: SCOPE_OPTION, parse: stripTrailingSlashes }],
    run: async ([configurations], { scope }, { root, cwd }) =>
        await runAddCommand({ root, cwd, configurations: [...new Set(configurations)], scope }),
};
