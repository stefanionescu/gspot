import { isTable } from '#cli/system/tables.ts';
import { GspotError } from '#cli/system/errors.ts';
import type { Session } from '#cli/types/tools.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import { buildSettings } from '#cli/settings/read.ts';
import type { TomlTable } from '#cli/types/settings.ts';
import { selectForScope } from '#cli/settings/scopes.ts';
import type { CommandResult } from '#cli/types/system.ts';
import { stripTrailingSlashes } from '#cli/system/paths.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import { MANAGED_KEYS_NOTE } from '#cli/config/generation.ts';
import { settingsSchema } from '#cli/schemas/settings/file.ts';
import { removeKey, getScopeTable } from '#cli/settings/edit.ts';
import { buildAvailableSettings } from '#cli/settings/available.ts';
import { validateReason } from '#cli/settings/validation/reasons.ts';
import { formatNameList, formatCountVerb } from '#cli/system/text.ts';
import { SCOPE_OPTION, REASON_OPTION } from '#cli/config/commands/help.ts';
import { selectForInit, listDetectedAdditions } from '#cli/repository/proposals.ts';
import { GSPOT_REMOVE, REMOVE_CONFIGURATION_MESSAGE } from '#cli/config/commands/edits.ts';
import { findSetting, listWrittenKeys, listSettingsTables } from '#cli/settings/inherit.ts';
import type { ScopeFlags, CommandDefinition, ConfigurationsOptions } from '#cli/types/commands/edits.ts';

import {
    writeSettingsEdit,
    buildUnchangedResult,
    formatConfigurationChange,
    readConfigurationEditContext,
} from '#cli/commands/edits.ts';

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
        const verb = formatCountVerb(options.configurations.length, 'is', 'are');
        return buildUnchangedResult(`No change: ${formatNameList(options.configurations)} ${verb} not selected.`);
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

export const removeCommand: CommandDefinition<[string[]], ScopeFlags & { reason: string }> = {
    name: 'remove',
    arguments: [{ term: '<configuration...>' }],
    options: [
        { flags: REASON_OPTION, required: true },
        { flags: SCOPE_OPTION, parse: stripTrailingSlashes },
    ],
    run: async ([configurations], { reason, scope }, { root, cwd }) => {
        const invalid = validateReason(GSPOT_REMOVE, reason, REMOVE_CONFIGURATION_MESSAGE);
        if (invalid !== undefined) throw new GspotError('arguments', invalid);
        return await runRemoveCommand({ root, cwd, configurations: [...new Set(configurations)], reason, scope });
    },
};
