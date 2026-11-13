import { isDeepStrictEqual } from 'node:util';

import {
    EVERY_CHECK,
    SHIPPED_ESLINT_RULES,
    WEAKENING_FIXES,
    WEAKENING_IGNORE_HELP,
    WEAKENING_RULES,
} from '#cli/config/configurations/gspot.ts';
import { LEVELS } from '#cli/config/manifests.ts';
import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { WEAKENING_EXPLANATIONS } from '#cli/configurations/general/gspot/explanations.ts';
import { listAllowedRules } from '#cli/configurations/import-rules.ts';
import { readCommittedTexts } from '#cli/repository/revisions/files.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import { buildAvailableSettings } from '#cli/settings/available.ts';
import { parseAcceptedSettings } from '#cli/settings/parse.ts';
import { listRemovedConfigurations, selectConfigurationsForScope } from '#cli/settings/scopes.ts';
import { isWeakening } from '#cli/settings/validation/reasons.ts';
import { getSettingValue } from '#cli/settings/values/inherit.ts';
import { listSettingsTables, listWrittenKeys } from '#cli/settings/values/written.ts';
import { isTable } from '#cli/system/tables.ts';
import type { Weakening } from '#cli/types/configurations/general.ts';
import type { BuiltInCheckResult, CheckCode, CheckSession } from '#cli/types/engine/run.ts';
import type { IgnoreRecord, Settings, SettingsTable } from '#cli/types/settings.ts';

function listIgnoreWeakenings(base: IgnoreRecord[], head: IgnoreRecord[]): Weakening[] {
    return head.flatMap((record) => {
        const same = base.filter(({ check, rule }) => check === record.check && rule === record.rule);
        if (same.some(({ paths }) => paths === undefined)) return [];
        const held = new Set(same.flatMap(({ paths = [] }) => paths));
        const added = (record.paths ?? ['every path']).filter((path) => !held.has(path));
        if (added.length === 0) return [];
        const name = [record.check ?? EVERY_CHECK, ...(record.rule === undefined ? [] : [record.rule])].join(' ');
        return [
            {
                rule: WEAKENING_RULES.ignore,
                file: SETTINGS_FILE,
                change: `An ignore of ${name} covers ${added.join(', ')}`,
                reason: record.reason,
            },
        ];
    });
}

function listConfigurationWeakenings(base: Settings, head: Settings, tracked: string[]): Weakening[] {
    const removals = listRemovedConfigurations(head);
    const tables = new Map(listSettingsTables(head).map(({ table, scopePath }) => [scopePath, table]));
    return listSettingsTables(base).flatMap(({ table, scopePath }) => {
        const kept = tables.get(scopePath);
        if (kept === undefined && tracked.every((path) => !isInScope(path, scopePath))) return [];
        const removed = new Set([
            ...table.configurations.filter((name) => kept?.configurations.includes(name) !== true),
            ...(kept?.removed_configurations ?? []).filter((name) => !table.removed_configurations.includes(name)),
        ]);
        const place = scopePath === '' ? '' : ` in ${scopePath}`;
        return [...removed].map((name) => ({
            rule: WEAKENING_RULES.configuration,
            file: SETTINGS_FILE,
            change: `The configuration ${name} goes${place}`,
            reason: removals.find((each) => each.scope === scopePath && each.name === name)?.reason,
        }));
    });
}

function listSwitchWeakenings(base: Settings, head: Settings): Weakening[] {
    const file = SETTINGS_FILE;
    const excluded = head.rule_files.exclude.filter((path) => !base.rule_files.exclude.includes(path));
    return [
        ...(LEVELS.indexOf(head.level) < LEVELS.indexOf(base.level)
            ? [{ rule: WEAKENING_RULES.level, file, change: `The level drops from ${base.level} to ${head.level}` }]
            : []),
        ...(base.hooks.enabled && !head.hooks.enabled
            ? [{ rule: WEAKENING_RULES.hooks, file, change: 'The Git hooks turn off' }]
            : []),
        ...(base.rule_files.enabled && !head.rule_files.enabled
            ? [{ rule: WEAKENING_RULES.ruleFiles, file, change: 'The rule files turn off' }]
            : []),
        ...excluded.map((path) => ({
            rule: WEAKENING_RULES.ruleFiles,
            file,
            change: `The rule files leave out ${path}`,
        })),
    ];
}

function listSettingMoves(base: Settings, head: Settings): Weakening[] {
    const tables = new Map(listSettingsTables(base).map(({ table, scopePath }) => [scopePath, table]));
    return listSettingsTables(head).flatMap(({ table, scopePath }) => {
        const previous = tables.get(scopePath);
        if (previous === undefined) return [];
        const available = buildAvailableSettings(selectConfigurationsForScope(head, scopePath), head.level);
        const keys = new Set([...listWrittenKeys(table, available), ...listWrittenKeys(previous, available)]);
        const place = scopePath === '' ? '' : ` in ${scopePath}`;
        return [...keys].flatMap((key) => {
            const moved = getSettingValue(available, head, key, scopePath);
            const before = getSettingValue(available, base, key, scopePath);
            if (moved === undefined || !isWeakening(moved.setting, moved.value, before?.value)) return [];
            const values = `from ${JSON.stringify(before?.value)} to ${JSON.stringify(moved.value)}`;
            return [
                {
                    rule: WEAKENING_RULES.setting,
                    file: SETTINGS_FILE,
                    change: `${key} moves ${values}${place}`,
                    reason: moved.reason,
                },
            ];
        });
    });
}

/**
A rule that the head adds widens no rule of the base, so its name does not count as a new import of the rules below
it.
*/
function listImportRuleWeakenings(base: Settings, head: Settings): Weakening[] {
    const file = SETTINGS_FILE;
    const rule = WEAKENING_RULES.importRule;
    const names = new Set(base.import_rule.map(({ name }) => name));
    const tables = new Map(listSettingsTables(head).map(({ table, scopePath }) => [scopePath, table]));
    return [
        ...base.import_rule.flatMap(({ name, paths }) => {
            const index = head.import_rule.findIndex((each) => each.name === name);
            const kept = head.import_rule[index];
            if (kept === undefined) return [{ rule, file, change: `The import rule ${name} goes` }];
            // The first name is the rule itself. Compare only the names that can_import or the rules above give.
            const [, ...allowed] = listAllowedRules(
                base.import_rule,
                base.import_rule.findIndex((each) => each.name === name),
            );
            const [, ...reached] = listAllowedRules(head.import_rule, index);
            const imports = reached.filter((each) => names.has(each) && !allowed.includes(each));
            const added = kept.paths.filter((path) => !paths.includes(path));
            return [
                ...(imports.length > 0
                    ? [{ rule, file, change: `The import rule ${name} may import ${imports.join(', ')}` }]
                    : []),
                ...(added.length > 0
                    ? [{ rule, file, change: `The import rule ${name} covers ${added.join(', ')}` }]
                    : []),
            ];
        }),
        ...listSettingsTables(base).flatMap(({ table, scopePath }) => {
            const kept = tables.get(scopePath)?.javascript?.import_boundaries ?? [];
            const removed = (table.javascript?.import_boundaries ?? []).filter((folder) => !kept.includes(folder));
            const place = scopePath === '' ? '' : ` in ${scopePath}`;
            return removed.length === 0
                ? []
                : [{ rule, file, change: `javascript.import_boundaries loses ${removed.join(', ')}${place}` }];
        }),
    ];
}

function listMovedOptionKeys(shipped: unknown, options: readonly unknown[]): string[] {
    const shippedOptions = Array.isArray(shipped) ? shipped.slice(1) : [];
    return shippedOptions.flatMap((shippedOption: unknown, index) => {
        if (!isTable(shippedOption)) return [];
        const option = options[index];
        return Object.keys(shippedOption).filter(
            (key) => !isTable(option) || !isDeepStrictEqual(option[key], shippedOption[key]),
        );
    });
}

function listRuleEntries(table: SettingsTable | undefined): Array<[string, readonly unknown[]]> {
    const rules = table?.tools?.eslint?.rules;
    return rules === undefined ? [] : Object.entries(rules);
}

/**
ESLint options of `gspot.toml` replace the shipped options of the rule. Options that the base holds unchanged are not
reported again.
*/
function listRuleOptionWeakenings(base: Settings, head: Settings): Weakening[] {
    const tables = new Map(listSettingsTables(base).map(({ table, scopePath }) => [scopePath, table]));
    return listSettingsTables(head).flatMap(({ table, scopePath }) => {
        const previous = new Map(listRuleEntries(tables.get(scopePath)));
        const place = scopePath === '' ? '' : ` in ${scopePath}`;
        return listRuleEntries(table)
            .filter(([name, options]) => !isDeepStrictEqual(previous.get(name), options))
            .flatMap(([name, options]) => {
                const keys = listMovedOptionKeys(SHIPPED_ESLINT_RULES[name], options);
                return keys.length === 0
                    ? []
                    : [
                          {
                              rule: WEAKENING_RULES.ruleOptions,
                              file: SETTINGS_FILE,
                              change: `The options of ${name} in tools.eslint.rules leave out or change the shipped ${keys.join(', ')}${place}`,
                          },
                      ];
            });
    });
}

async function checkWeakenings(session: CheckSession): Promise<BuiltInCheckResult> {
    const { root, settings, cancelSignal, repository, selection } = session;
    const paths = [SETTINGS_FILE];
    const texts = await readCommittedTexts(root, paths, selection?.base ?? 'HEAD', cancelSignal);
    const settingsText = texts.get(SETTINGS_FILE);
    const tracked = repository.files.map(({ path }) => path);
    // A base that gspot still refuses compares as the shipped defaults, so each weakening of the current file needs a
    // reason.
    const base = settingsText === undefined ? undefined : parseAcceptedSettings(settingsText);
    const weakenings =
        base === undefined
            ? []
            : [
                  ...listIgnoreWeakenings(base.ignore, settings.ignore),
                  ...listConfigurationWeakenings(base, settings, tracked),
                  ...listSwitchWeakenings(base, settings),
                  ...listSettingMoves(base, settings),
                  ...listImportRuleWeakenings(base, settings),
                  ...listRuleOptionWeakenings(base, settings),
              ];
    return {
        files: paths.filter((path) => tracked.includes(path)),
        findings: weakenings
            .filter(({ reason }) => reason === undefined)
            .map(({ rule, file, change }) => ({
                file,
                rule,
                message: `${change}, with no reason.`,
                help: Object.hasOwn(WEAKENING_FIXES, rule)
                    ? WEAKENING_FIXES[rule as keyof typeof WEAKENING_FIXES]
                    : WEAKENING_IGNORE_HELP.replace('{rule}', () => rule),
            })),
        notes: weakenings.flatMap(({ change, reason }) => (reason === undefined ? [] : [`${change}: ${reason}`])),
    };
}

export const GSPOT_WEAKENINGS_CHECKS: Readonly<Record<string, CheckCode>> = {
    'gspot/weakenings': { check: checkWeakenings, explanations: WEAKENING_EXPLANATIONS },
};
