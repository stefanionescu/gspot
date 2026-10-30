import { isTable } from '#cli/system/tables.ts';
import { GspotError } from '#cli/system/errors.ts';
import type { Session } from '#cli/types/session.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import { buildSettings } from '#cli/settings/read.ts';
import { selectForScope } from '#cli/settings/scopes.ts';
import { type Command } from '@commander-js/extra-typings';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { stripTrailingSlashes } from '#cli/system/paths.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import { settingsSchema } from '#cli/schemas/settings/file.ts';
import { removeKey, getScopeTable } from '#cli/settings/edit.ts';
import type { TomlTable } from '#cli/types/settings/settings.ts';
import { buildAvailableSettings } from '#cli/settings/available.ts';
import { validateReason } from '#cli/settings/validation/reasons.ts';
import { MANAGED_KEYS_NOTE } from '#cli/config/generation/generation.ts';
import type { CommandResult, CommandCompletion } from '#cli/types/terminal.ts';
import type { ConfigurationsOptions } from '#cli/types/generation/generation.ts';
import { selectForInit, listDetectedAdditions } from '#cli/repository/proposals.ts';
import { findSetting, listWrittenKeys, listSettingsTables } from '#cli/settings/inherit.ts';

import {
    writeSettingsEdit,
    formatConfigurationChange,
    readConfigurationEditContext,
} from '#cli/generation/settings-edit.ts';
import {
    SCOPE_OPTION,
    GSPOT_REMOVE,
    REASON_OPTION,
    REMOVE_CONFIGURATION_MESSAGE,
} from '#cli/config/commands/commands.ts';

function assertRemovable(names: string[], kept: string[], configurationsByName: Map<string, Configuration>): void {
    for (const configuration of names) {
        const chain = kept
            .map((name) => findRequirementChain(configuration, name, configurationsByName))
            .find((found) => found !== undefined);
        if (chain)
            throw new GspotError(
                'arguments',
                `Cannot remove ${configuration}: ${chain.join(' requires ')}. Remove ${chain[0] as string} first, or keep ${configuration}.`,
            );
    }
}

function removeUnusedSettings(
    table: TomlTable,
    configurationsByName: Map<string, Configuration>,
    scopePath: string,
): string {
    const edited = buildSettings(settingsSchema.parse(table), table);
    const general = configurationsByName
        .values()
        .filter((configuration) => configuration.group === 'general')
        .toArray();
    const removed: string[] = [];
    const affected = listSettingsTables(edited).filter((written) => isInScope(written.scope, scopePath));
    for (const written of affected) {
        const selected = selectForScope(edited, written.scope, configurationsByName);
        const available = buildAvailableSettings([...general, ...selected], edited.level);
        const keys = listWrittenKeys(written.table, available).filter(
            (key) => findSetting(available, key) === undefined,
        );
        for (const key of keys) removeKey(getScopeTable(table, written.scope), key);
        removed.push(...keys.map((key) => (written.scope === '' ? key : `${key} (scope ${written.scope})`)));
    }
    return removed.length === 0 ? '' : ` Removed settings ${removed.join(', ')}.`;
}

function listReturningConfigurations(
    session: Session,
    removal: { scope: string; removed: string[]; written: string[]; configurationsByName: Map<string, Configuration> },
): string[] {
    const { scope, removed, written, configurationsByName } = removal;
    const proposed = selectForInit({ repository: session.repository, configurationsByName, options: {} });
    const detected = scope === '' ? proposed.rootNames : (proposed.scopeConfigurations.get(scope) ?? []);
    return removed.filter((name) => detected.includes(name) || !written.includes(name));
}

async function runRemoveCommand(options: ConfigurationsOptions & { reason: string }): Promise<CommandResult> {
    const {
        root,
        input,
        scope,
        scopeTable,
        scopeSettings,
        selected: selectedNames,
        configurationsByName,
        context,
    } = await readConfigurationEditContext(options);
    const detected = listDetectedAdditions(context.session)
        .filter((addition) => addition.scope === scope)
        .flatMap((addition) => addition.configurations);
    const selected = [...new Set([...selectedNames, ...detected])];
    const kept = selected.filter((name) => !options.configurations.includes(name));
    assertRemovable(options.configurations, kept, configurationsByName);
    if (options.configurations.every((name) => !selected.includes(name))) {
        const summary = `No change: ${new Intl.ListFormat('en', { type: 'conjunction' }).format(options.configurations)} ${options.configurations.length === 1 ? 'is' : 'are'} not selected.`;
        return {
            text: summary + '\n',
            json: { changed: false, summary },
            exitCode: 0,
        };
    }
    const previous = scopeTable['removed_configurations'];
    const removed = options.configurations.filter((name) => selected.includes(name));
    const written = scopeSettings.configurations;
    const returning = listReturningConfigurations(context.session, { scope, removed, written, configurationsByName });
    scopeTable['configurations'] = written.filter((name) => !removed.includes(name));
    const reasons = {
        ...(isTable(previous) ? previous : {}),
        ...Object.fromEntries(returning.map((name) => [name, options.reason])),
    };
    if (Object.keys(reasons).length > 0) scopeTable['removed_configurations'] = reasons;
    const where = scope === '' ? '' : ` from scope ${scope}`;
    const unchanged = options.configurations.filter((name) => !selected.includes(name));
    const summary =
        formatConfigurationChange({ action: 'Removed', changed: removed, where, unchanged, state: 'not selected' }) +
        removeUnusedSettings(input.table, configurationsByName, scope);
    const ownsManagedKeys = configurationsByName
        .values()
        .filter((configuration) => removed.includes(configuration.name))
        .flatMap((configuration) => configuration.tools)
        .some((tool) => tool.replace_key?.some((replacement) => replacement.pointer === true) === true);
    return writeSettingsEdit(root, {
        cache: context.cache,
        listing: context.listing,
        edit: input,
        summary,
        notes: ownsManagedKeys ? [MANAGED_KEYS_NOTE] : [],
    });
}

function findRequirementChain(
    required: string,
    from: string,
    configurationsByName: Map<string, Configuration>,
): string[] | undefined {
    const seen = new Set<string>();
    function findChain(start: string): string[] | undefined {
        if (start === required) return [start];
        if (seen.has(start)) return undefined;
        seen.add(start);
        const requirements = configurationsByName.get(start)?.requires ?? [];
        for (const next of requirements) {
            const rest = findChain(next);
            if (rest !== undefined) return [start, ...rest];
        }
        return undefined;
    }
    return findChain(from);
}

/**
Register the remove command.

@param program the gspot program that gets the command.
@param onResult receives the result of the command.
*/
export function registerRemove(program: Command, onResult: CommandCompletion): void {
    program
        .command('remove')
        .argument('<configuration...>', COMMAND_HELP.remove.arguments['configuration'])
        .summary(COMMAND_HELP.remove.summary)
        .description(COMMAND_HELP.remove.description)
        .requiredOption(REASON_OPTION, COMMAND_HELP.remove.options[REASON_OPTION])
        .option(SCOPE_OPTION, COMMAND_HELP.remove.options[SCOPE_OPTION], stripTrailingSlashes)
        .action(async (configurations, flags) => {
            const invalid = validateReason(GSPOT_REMOVE, flags.reason, REMOVE_CONFIGURATION_MESSAGE);
            if (invalid !== undefined) throw new GspotError('arguments', invalid);
            onResult(
                await runRemoveCommand({
                    cwd: process.cwd(),
                    configurations: [...new Set(configurations)],
                    reason: flags.reason,
                    scope: flags.scope,
                }),
            );
        });
}
