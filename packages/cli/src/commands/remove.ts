import {
    buildUnchangedResult,
    formatConfigurationChange,
    readConfigurationEditContext,
    writeSettingsEdit,
} from '#cli/commands/edits.ts';
import { GSPOT_REMOVE } from '#cli/config/commands/edits.ts';
import { REASON_OPTION, SCOPE_OPTION } from '#cli/config/commands/help.ts';
import { MANAGED_KEYS_NOTE } from '#cli/config/generation.ts';
import { REMOVAL_REASON_SUGGESTION } from '#cli/config/settings/validation.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { listDetectedAdditions } from '#cli/repository/proposals.ts';
import { settingsSchema } from '#cli/schemas/settings/file.ts';
import { buildAvailableSettings } from '#cli/settings/available.ts';
import { addScopeTable, removeKey } from '#cli/settings/edit.ts';
import { findSetting, listSettingsTables, listWrittenKeys } from '#cli/settings/inherit.ts';
import { buildSettings } from '#cli/settings/read.ts';
import { selectConfigurationsForScope } from '#cli/settings/scopes.ts';
import { validateReason } from '#cli/settings/validation/reasons.ts';
import { GspotError } from '#cli/system/errors.ts';
import { isInScope } from '#cli/system/paths.ts';
import { isTable } from '#cli/system/tables.ts';
import { formatNameList } from '#cli/system/text.ts';
import type { CommandDefinition, ConfigurationsOptions, ScopeFlags } from '#cli/types/commands/edits.ts';
import type { TomlTable } from '#cli/types/settings.ts';
import type { CommandResult } from '#cli/types/system.ts';

function assertRemovable(names: string[], kept: string[]): void {
    for (const configuration of names) {
        const chain = kept
            .map((name) => findRequirementChain(configuration, name, new Set()))
            .find((found) => found !== undefined);
        if (chain)
            throw new GspotError(
                'arguments',
                `Cannot remove ${configuration}: ${chain.join(' requires ')}. Remove ${chain[0] as string} first, or keep ${configuration}.`,
            );
    }
}

function removeUnusedSettings(table: TomlTable, scopePath: string): string {
    const edited = buildSettings(settingsSchema.parse(table), table);
    const automatic = readConfigurations()
        .values()
        .filter((configuration) => configuration.always_selected)
        .toArray();
    const removed: string[] = [];
    const affected = listSettingsTables(edited).filter((written) => isInScope(written.scopePath, scopePath));
    for (const written of affected) {
        const selected = selectConfigurationsForScope(edited, written.scopePath);
        const available = buildAvailableSettings([...automatic, ...selected], edited.level);
        const keys = listWrittenKeys(written.table, available).filter(
            (key) => findSetting(available, key) === undefined,
        );
        for (const key of keys) removeKey(addScopeTable(table, written.scopePath), key);
        removed.push(...keys.map((key) => (written.scopePath === '' ? key : `${key} (scope ${written.scopePath})`)));
    }
    return removed.length === 0 ? '' : ` Removed settings ${removed.join(', ')}.`;
}

async function runRemoveCommand(options: ConfigurationsOptions & { reason: string }): Promise<CommandResult> {
    const context = await readConfigurationEditContext(options);
    const { edit: input, scopePath, scopeTable, scopeSettings, selected: selectedNames } = context;
    const detected = listDetectedAdditions(context.session)
        .filter((addition) => addition.scopePath === scopePath)
        .flatMap((addition) => addition.configurations);
    const selected = [...new Set([...selectedNames, ...detected])];
    const kept = selected.filter((name) => !options.configurations.includes(name));
    assertRemovable(options.configurations, kept);
    if (options.configurations.every((name) => !selected.includes(name))) {
        const verb = options.configurations.length === 1 ? 'is' : 'are';
        return buildUnchangedResult(`No change: ${formatNameList(options.configurations)} ${verb} not selected.`);
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
        removeUnusedSettings(input.table, scopePath);
    const hasManagedKeys = readConfigurations()
        .values()
        .filter((configuration) => removed.includes(configuration.name))
        .flatMap((configuration) => configuration.tools)
        .some((tool) => tool.replace_key?.some((replacement) => replacement.pointer === true) === true);
    return writeSettingsEdit(context, { summary, notes: hasManagedKeys ? [MANAGED_KEYS_NOTE] : [] });
}

function findRequirementChain(required: string, from: string, seen: Set<string>): string[] | undefined {
    if (from === required) return [from];
    if (seen.has(from)) return undefined;
    seen.add(from);
    const requirements = readConfigurations().get(from)?.requires ?? [];
    for (const next of requirements) {
        const rest = findRequirementChain(required, next, seen);
        if (rest !== undefined) return [from, ...rest];
    }
    return undefined;
}

export const REMOVE_COMMAND: CommandDefinition<[string[]], ScopeFlags & { reason: string }> = {
    name: 'remove',
    arguments: [{ term: '<configuration...>' }],
    options: [{ flags: REASON_OPTION, required: true }, { flags: SCOPE_OPTION }],
    run: async ({ arguments: commandArguments, flags: { reason, scope: scopePath }, root, cwd }) => {
        const [configurations] = commandArguments;
        const invalid = validateReason(GSPOT_REMOVE, reason, REMOVAL_REASON_SUGGESTION);
        if (invalid !== undefined) throw new GspotError('arguments', invalid);
        return await runRemoveCommand({ root, cwd, configurations: [...new Set(configurations)], reason, scopePath });
    },
};
