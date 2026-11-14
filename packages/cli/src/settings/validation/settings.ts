import { readConfigurations } from '#cli/manifests/read.ts';
import { settingsSchema } from '#cli/schemas/settings/file.ts';
import { validateKeys } from '#cli/settings/validation/keys.ts';
import { buildAvailableSettings } from '#cli/settings/available.ts';
import type { WrittenConfiguration } from '#cli/types/manifests.ts';
import { listSettingsTables } from '#cli/settings/values/written.ts';
import type { Settings, SettingsError } from '#cli/types/settings.ts';
import { selectConfigurationsForScope } from '#cli/settings/scopes.ts';
import { validateSettingRules } from '#cli/settings/validation/rules.ts';
import { REMOVED_CONFIGURATIONS } from '#cli/config/settings/validation.ts';
import { listCheckIds, formatUnknownCheck } from '#cli/manifests/checks.ts';
import { validateSwiftTargets, validateSettingReasons } from '#cli/settings/validation/reasons.ts';
import { validateScopePaths, validateRuleExcludes, validateRuleFilePaths } from '#cli/settings/validation/files.ts';

import {
    findRequirementChain,
    selectConfigurations,
    formatAlwaysOnMessage,
    formatRequiredRemoval,
    listUnknownConfigurations,
} from '#cli/manifests/select.ts';

function validateRemovedConfigurations(settings: Settings): SettingsError[] {
    const configurations = readConfigurations();
    const errors: SettingsError[] = [];
    for (const { table, scopePath, path } of listSettingsTables(settings)) {
        for (const name of table.configurations)
            if (table.removed_configurations.includes(name))
                errors.push({
                    path: [...path, 'configurations'],
                    message: `${name} is both selected and removed. Keep it in only one list.`,
                });
        const selected = selectConfigurationsForScope(settings, scopePath).map((configuration) => configuration.name);
        for (const name of table.removed_configurations) {
            const removedPath = [...path, REMOVED_CONFIGURATIONS, name];
            if (configurations.get(name)?.always_selected === true) {
                errors.push({ path: removedPath, message: formatAlwaysOnMessage(name) });
                continue;
            }
            const chain = selected
                .filter((kept) => kept !== name)
                .map((kept) => findRequirementChain(name, kept, new Set()))
                .find((found) => found !== undefined);
            if (chain !== undefined) errors.push({ path: removedPath, message: formatRequiredRemoval(name, chain) });
        }
    }
    return errors;
}

function validateCheckIds(settings: Settings): SettingsError[] {
    const bundledChecks = listCheckIds([]);
    const checks = listCheckIds(Object.values(settings.commandChecks));
    return [
        ...Object.values(settings.commandChecks).flatMap((commandCheck, index) =>
            bundledChecks.includes(commandCheck.id)
                ? {
                      path: ['command_check', index, 'id'],
                      message: `The command check ${commandCheck.id} has the same ID as a configuration check. Give it another ID.`,
                  }
                : [],
        ),
        ...settings.ignore.flatMap((ignore, index) =>
            ignore.check === undefined || checks.includes(ignore.check)
                ? []
                : {
                      path: ['ignore', index, 'check'],
                      message: formatUnknownCheck(ignore.check, checks),
                  },
        ),
    ];
}

export function validateSettings(settings: Settings, root: string, selecting: readonly string[] = []): SettingsError[] {
    const written: WrittenConfiguration[] = [
        ...settings.configurations.map((name, index) => ({ name, path: ['configurations', index] })),
        ...settings.scopes.values().flatMap((scope, scopeIndex) =>
            scope.configurations.map((name, index) => ({
                name,
                path: ['scope', scopeIndex, 'configurations', index],
            })),
        ),
    ];
    const removed: WrittenConfiguration[] = [
        ...settings.removed_configurations.map((name) => ({ name, path: [REMOVED_CONFIGURATIONS, name] })),
        ...settings.scopes.values().flatMap((scope, scopeIndex) =>
            scope.removed_configurations.map((name) => ({
                name,
                path: ['scope', scopeIndex, REMOVED_CONFIGURATIONS, name],
            })),
        ),
    ];
    const unknown = listUnknownConfigurations([...written, ...removed]);
    if (unknown.length > 0) return unknown;
    const scopes = new Map(
        settings.scopes
            .keys()
            .map((scopePath) => [
                scopePath,
                buildAvailableSettings(selectConfigurationsForScope(settings, scopePath), settings.level),
            ]),
    );
    const rootKeys = buildAvailableSettings(selectConfigurationsForScope(settings, ''), settings.level);
    const configurations = readConfigurations();
    const alwaysAccepted = new Set([
        ...configurations.values().filter((configuration) => configuration.always_selected),
        ...selectConfigurations(selecting.filter((name) => configurations.has(name))),
    ]);
    const errors: SettingsError[] = [
        ...validateRemovedConfigurations(settings),
        ...validateSettingReasons(settingsSchema, settings.written, []),
        ...validateSettingRules(settings),
        ...validateSwiftTargets(settings, rootKeys),
        ...validateCheckIds(settings),
        ...validateRuleExcludes(settings.rule_files.exclude),
        ...validateScopePaths(root, settings),
        ...validateRuleFilePaths(root, settings),
        ...validateKeys(rootKeys, settings, scopes, buildAvailableSettings([...alwaysAccepted], settings.level)),
    ];
    return errors;
}
