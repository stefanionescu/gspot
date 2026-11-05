import {
    buildUnchangedResult,
    formatConfigurationChange,
    readConfigurationEditContext,
    writeSettingsEdit,
} from '#cli/commands/edits.ts';
import { GSPOT_REMOVE, REMOVE_CONFIGURATION_MESSAGE } from '#cli/config/commands/edits.ts';
import { REASON_OPTION, SCOPE_OPTION } from '#cli/config/commands/help.ts';
import { MANAGED_KEYS_NOTE } from '#cli/config/generation.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { listDetectedAdditions, selectProposedConfigurations } from '#cli/repository/proposals.ts';
import { settingsSchema } from '#cli/schemas/settings/file.ts';
import { buildAvailableSettings } from '#cli/settings/available.ts';
import { addScopeTable, removeKey } from '#cli/settings/edit.ts';
import { findSetting, listSettingsTables, listWrittenKeys } from '#cli/settings/inherit.ts';
import { buildSettings } from '#cli/settings/read.ts';
import { selectConfigurationsForScope } from '#cli/settings/scopes.ts';
import { validateReason } from '#cli/settings/validation/reasons.ts';
import { GspotError } from '#cli/system/errors.ts';
import { isInScope, stripTrailingSlashes } from '#cli/system/paths.ts';
import { isTable } from '#cli/system/tables.ts';
import { formatNameList } from '#cli/system/text.ts';
import type { CommandDefinition, ConfigurationsOptions, ScopeFlags } from '#cli/types/commands/edits.ts';
import type { TomlTable } from '#cli/types/settings.ts';
import type { CommandResult } from '#cli/types/system.ts';
import type { Session } from '#cli/types/tools.ts';

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
    const general = readConfigurations()
        .values()
        .filter((configuration) => configuration.group === 'general')
        .toArray();
    const removed: string[] = [];
    const affected = listSettingsTables(edited).filter((written) => isInScope(written.scopePath, scopePath));
    for (const written of affected) {
        const selected = selectConfigurationsForScope(edited, written.scopePath);
        const available = buildAvailableSettings([...general, ...selected], edited.level);
        const keys = listWrittenKeys(written.table, available).filter(
            (key) => findSetting(available, key) === undefined,
        );
        for (const key of keys) removeKey(addScopeTable(table, written.scopePath), key);
        removed.push(...keys.map((key) => (written.scopePath === '' ? key : `${key} (scope ${written.scopePath})`)));
    }
    return removed.length === 0 ? '' : ` Removed settings ${removed.join(', ')}.`;
}

function listReturningConfigurations(
    session: Session,
    removal: { scopePath: string; removed: string[]; written: string[] },
): string[] {
    const { scopePath, removed, written } = removal;
    const proposed = selectProposedConfigurations({ repository: session.repository, options: {} });
    const detected = scopePath === '' ? proposed.rootNames : (proposed.scopeConfigurations.get(scopePath) ?? []);
    return removed.filter((name) => detected.includes(name) || !written.includes(name));
}

async function runRemoveCommand(options: ConfigurationsOptions & { reason: string }): Promise<CommandResult> {
    const {
        root,
        input,
        scopePath,
        scopeTable,
        scopeSettings,
        selected: selectedNames,
        context,
    } = await readConfigurationEditContext(options);
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
    const written = scopeSettings.configurations;
    const returning = listReturningConfigurations(context.session, { scopePath, removed, written });
    scopeTable['configurations'] = written.filter((name) => !removed.includes(name));
    const reasons = {
        ...(isTable(previous) && previous),
        ...Object.fromEntries(returning.map((name) => [name, options.reason])),
    };
    if (Object.keys(reasons).length > 0) scopeTable['removed_configurations'] = reasons;
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
    return writeSettingsEdit(root, {
        cache: context.cache,
        listing: context.listing,
        edit: input,
        summary,
        notes: hasManagedKeys ? [MANAGED_KEYS_NOTE] : [],
    });
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
    options: [
        { flags: REASON_OPTION, required: true },
        { flags: SCOPE_OPTION, parse: stripTrailingSlashes },
    ],
    run: async ({ arguments: commandArguments, flags: { reason, scope: scopePath }, root, cwd }) => {
        const [configurations] = commandArguments;
        const invalid = validateReason(GSPOT_REMOVE, reason, REMOVE_CONFIGURATION_MESSAGE);
        if (invalid !== undefined) throw new GspotError('arguments', invalid);
        return await runRemoveCommand({ root, cwd, configurations: [...new Set(configurations)], reason, scopePath });
    },
};
