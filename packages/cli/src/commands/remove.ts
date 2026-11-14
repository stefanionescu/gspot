import { isTable } from '#cli/system/tables.ts';
import { GspotError } from '#cli/system/errors.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import { GSPOT_REMOVE } from '#cli/config/manifests.ts';
import type { TomlTable } from '#cli/types/settings.ts';
import type { CommandResult } from '#cli/types/system.ts';
import { formatNameState } from '#cli/system/text/messages.ts';
import { buildSettingsFromTable } from '#cli/settings/parse.ts';
import { buildAvailableSettings } from '#cli/settings/available.ts';
import { validateReason } from '#cli/settings/validation/reasons.ts';
import { listSettingsTables } from '#cli/settings/values/written.ts';
import { selectConfigurationsForScope } from '#cli/settings/scopes.ts';
import { SCOPE_OPTION, REASON_OPTION } from '#cli/config/commands/help.ts';
import { addScopeTable, removeUnknownKeys } from '#cli/settings/toml/edit.ts';
import { REMOVAL_REASON_SUGGESTION } from '#cli/config/settings/validation.ts';
import { listDetectedAdditions } from '#cli/repository/detection/proposals.ts';
import { findRequirementChain, formatRequiredRemoval } from '#cli/manifests/select.ts';
import type { ScopeFlags, RemoveOptions, CommandDefinition } from '#cli/types/commands.ts';

import {
    writeSettingsEdit,
    buildUnchangedResult,
    formatConfigurationChange,
    readConfigurationEditContext,
} from '#cli/commands/edits.ts';

function assertRemovable(names: string[], kept: string[]): void {
    for (const configuration of names) {
        const chain = kept
            .map((name) => findRequirementChain(configuration, name, new Set()))
            .find((found) => found !== undefined);
        if (chain) throw new GspotError('arguments', formatRequiredRemoval(configuration, chain));
    }
}

function removeUnusedSettings(table: TomlTable, scopePath: string): string {
    const edited = buildSettingsFromTable(table);
    const removed: string[] = [];
    const affected = listSettingsTables(edited).filter((written) => isInScope(written.scopePath, scopePath));
    for (const written of affected) {
        const selected = selectConfigurationsForScope(edited, written.scopePath);
        const available = buildAvailableSettings(selected, edited.level);
        const keys = removeUnknownKeys(addScopeTable(table, written.scopePath), written.table, available);
        removed.push(...keys.map((key) => (written.scopePath === '' ? key : `${key} (scope ${written.scopePath})`)));
    }
    return removed.length === 0 ? '' : ` Removed settings ${removed.join(', ')}.`;
}

async function runRemoveCommand(options: RemoveOptions): Promise<CommandResult> {
    const context = await readConfigurationEditContext(options);
    const { file, scopePath, scopeTable, scopeSettings, selected: selectedNames } = context;
    const detected = listDetectedAdditions(context.session)
        .filter((addition) => addition.scopePath === scopePath)
        .flatMap((addition) => addition.configurations);
    const selected = [...new Set([...selectedNames, ...detected])];
    const kept = selected.filter((name) => !options.configurations.includes(name));
    assertRemovable(options.configurations, kept);
    if (options.configurations.every((name) => !selected.includes(name))) {
        return buildUnchangedResult(`No change: ${formatNameState(options.configurations, 'not selected')}.`);
    }
    const previous = scopeTable['removed_configurations'];
    const removed = options.configurations.filter((name) => selected.includes(name));
    const remaining = scopeSettings.configurations.filter((name) => !removed.includes(name));
    if (remaining.length > 0) scopeTable['configurations'] = remaining;
    else delete scopeTable['configurations'];
    scopeTable['removed_configurations'] = {
        ...(isTable(previous) && previous),
        ...Object.fromEntries(removed.map((name) => [name, options.reason])),
    };
    const where = scopePath === '' ? '' : ` from scope ${scopePath}`;
    const unchanged = options.configurations.filter((name) => !selected.includes(name));
    const summary =
        formatConfigurationChange({ action: 'Removed', changed: removed, where, unchanged, state: 'not selected' }) +
        removeUnusedSettings(file.table, scopePath);
    return writeSettingsEdit(context, { summary });
}

export const REMOVE_COMMAND: CommandDefinition<
    [string[]],
    ScopeFlags & { reason: string },
    Omit<RemoveOptions, 'root'>
> = {
    name: 'remove',
    arguments: [{ term: '<configuration...>' }],
    options: [{ flags: REASON_OPTION, required: true }, { flags: SCOPE_OPTION }],
    parse: ({ arguments: commandArguments, flags: { reason, scope: scopePath }, cwd }) => {
        const [configurations] = commandArguments;
        const invalid = validateReason(GSPOT_REMOVE, reason, REMOVAL_REASON_SUGGESTION);
        if (invalid !== undefined) throw new GspotError('arguments', invalid);
        return { cwd, configurations: [...new Set(configurations)], reason, scopePath };
    },
    run: runRemoveCommand,
};
