import { isInScope } from '#cli/system/paths.ts';
import { LEVELS } from '#cli/config/manifests.ts';
import { EVERY_CHECK } from '#cli/config/engine.ts';
import { buildSettings } from '#cli/settings/read.ts';
import { findText } from '#cli/system/files/reads.ts';
import { parseBaseline } from '#cli/engine/baseline.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { settingsSchema } from '#cli/schemas/settings/file.ts';
import { isWeakening } from '#cli/settings/validation/reasons.ts';
import { buildAvailableSettings } from '#cli/settings/available.ts';
import type { Settings, IgnoreRecord } from '#cli/types/settings.ts';
import type { Weakening } from '#cli/types/configurations/general.ts';
import { readCommittedTexts } from '#cli/repository/revisions/files.ts';
import { BASELINE_FILE, SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { WEAKENING_RULE_DOCS } from '#cli/config/configurations/rule-docs/gspot.ts';
import { getSettingValue, listWrittenKeys, listSettingsTables } from '#cli/settings/inherit.ts';
import { listRemovedConfigurations, selectConfigurationsForScope } from '#cli/settings/scopes.ts';

import {
    type CheckCode,
    type CheckSession,
    type BaselineCount,
    type BuiltInCheckResult,
} from '#cli/types/engine/run.ts';
import {
    WEAKENING_FIXES,
    WEAKENING_RULES,
    WEAKENING_IGNORE_HELP,
    WEAKENINGS_UNREAD_BASE,
} from '#cli/config/configurations/structure.ts';

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
                rule: 'ignore',
                file: SETTINGS_FILE,
                change: `An ignore of ${name} covers ${added.join(', ')}`,
                reason: record.reason,
            },
        ];
    });
}

function listConfigurationWeakenings(base: Settings, head: Settings, tracked: string[]): Weakening[] {
    const removals = listRemovedConfigurations(head);
    const tables = new Map(listSettingsTables(head).map(({ table, scope }) => [scope, table]));
    return listSettingsTables(base).flatMap(({ table, scope = '' }) => {
        const kept = tables.get(scope);
        if (kept === undefined && tracked.every((path) => !isInScope(path, scope))) return [];
        const removed = new Set([
            ...table.configurations.filter((name) => kept?.configurations.includes(name) !== true),
            ...(kept?.removed_configurations ?? []).filter((name) => !table.removed_configurations.includes(name)),
        ]);
        const place = scope === '' ? '' : ` in ${scope}`;
        return [...removed].map((name) => ({
            rule: WEAKENING_RULES.configuration,
            file: SETTINGS_FILE,
            change: `The configuration ${name} goes${place}`,
            reason: removals.find((each) => each.scope === scope && each.name === name)?.reason,
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
    const tables = new Map(listSettingsTables(base).map(({ table, scope }) => [scope, table]));
    return listSettingsTables(head).flatMap(({ table, scope = '' }) => {
        const previous = tables.get(scope);
        if (previous === undefined) return [];
        const available = buildAvailableSettings(selectConfigurationsForScope(head, scope), head.level);
        const keys = new Set([...listWrittenKeys(table, available), ...listWrittenKeys(previous, available)]);
        const place = scope === '' ? '' : ` in ${scope}`;
        return [...keys].flatMap((key) => {
            const moved = getSettingValue(available, head, key, scope);
            const before = getSettingValue(available, base, key, scope);
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

function listSettingsWeakenings(text: string, head: Settings, tracked: string[]): Weakening[] {
    const written = parseTomlFile(SETTINGS_FILE, text);
    const parsed = settingsSchema.safeParse(written);
    if (!parsed.success) return [WEAKENINGS_UNREAD_BASE];
    const base = buildSettings(parsed.data, written);
    return [
        ...listIgnoreWeakenings(base.ignore, head.ignore),
        ...listConfigurationWeakenings(base, head, tracked),
        ...listSwitchWeakenings(base, head),
        ...listSettingMoves(base, head),
    ];
}

function listBaselineGrowth(text: string | undefined, head: BaselineCount[]): Weakening[] {
    const base = parseBaseline(text);
    if (text === undefined && head.length > 0)
        return [{ rule: WEAKENING_RULES.baseline, file: BASELINE_FILE, change: BASELINE_FILE, reason: 'it is new' }];
    return head.flatMap(({ file, check, rule, count }) => {
        const held = base.find((each) => each.file === file && each.check === check && each.rule === rule);
        const previous = held?.count ?? 0;
        if (count <= previous) return [];
        return [
            {
                rule: WEAKENING_RULES.baseline,
                file: BASELINE_FILE,
                change: `The count of ${rule} in ${file} grows from ${String(previous)} to ${String(count)}`,
            },
        ];
    });
}

/**
Compare gspot.toml and the baseline with the base revision: the pushed range, `--base`, or the last commit. A weakening
with no reason fails the check, and one with a reason prints as a note.

@param session the settings of the tree that the run checks, and the base revision of the run.
*/
async function checkWeakenings(session: CheckSession): Promise<BuiltInCheckResult> {
    const { root, settings, cancelSignal, repository, selection } = session;
    const paths = [SETTINGS_FILE, BASELINE_FILE];
    const texts = await readCommittedTexts(root, paths, selection?.base ?? 'HEAD', cancelSignal);
    const settingsText = texts.get(SETTINGS_FILE);
    const tracked = repository.files.map(({ path }) => path);
    const weakenings = [
        ...(settingsText === undefined ? [] : listSettingsWeakenings(settingsText, settings, tracked)),
        ...listBaselineGrowth(texts.get(BASELINE_FILE), parseBaseline(findText(root, BASELINE_FILE))),
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
    'gspot/weakenings': { check: checkWeakenings, ruleDocs: WEAKENING_RULE_DOCS },
};
