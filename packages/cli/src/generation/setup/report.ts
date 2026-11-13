import { styleText } from 'node:util';

import {
    ALWAYS_SELECTED_NOUN,
    CARRYOVER_GROUPS,
    CARRYOVER_HEADING,
    CHANGE_LATER_MESSAGE,
    CI_OFF_MESSAGE,
    COLUMN_GAP,
    CONFIGURATION_WIDTH,
    DELETED_RULES_NOTE,
    LINT_COMMANDS_HEADING,
    LINT_FOLDERS_HEADING,
    ORIGIN_WIDTH,
} from '#cli/config/generation/setup.ts';
import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { formatCount } from '#cli/system/text/messages.ts';
import type { CarryoverRow, InitFileRow, InitPlan } from '#cli/types/generation.ts';

function formatFileSection(title: string, rows: InitFileRow[]): string[] {
    if (rows.length === 0) return [];
    const width = Math.max(...rows.map((row) => row.path.length)) + COLUMN_GAP;
    return [title, ...rows.map((row) => `  ${row.path.padEnd(width)}${row.note}`), ''];
}

function formatCheckCounts(rows: InitPlan['configurations'], level: InitPlan['level']): string {
    const checks = rows.reduce((total, row) => total + row.checks, 0);
    const checksOff = rows.reduce((total, row) => total + row.checksOff, 0);
    return `${formatCount(checks, 'check')} (${String(checksOff)} off at ${level})`;
}

function formatConfigurationSection(rows: InitPlan['configurations'], level: InitPlan['level']): string[] {
    const always = rows.filter((row) => row.origin === 'always');
    const selected = rows.filter((row) => row.origin !== 'always');
    const scopeWidth = Math.max(0, ...selected.map((row) => row.scopes.join(', ').length));
    const lines = selected.map((row) =>
        [
            row.configuration.padEnd(CONFIGURATION_WIDTH),
            row.origin.padEnd(ORIGIN_WIDTH),
            row.scopes.join(', ').padEnd(scopeWidth),
            formatCheckCounts([row], level),
        ].join(' '),
    );
    const alwaysLine = `${formatCount(always.length, ALWAYS_SELECTED_NOUN)}: ${formatCheckCounts(always, level)}`;
    return ['configurations', ...[...lines, alwaysLine].map((line) => `  ${line}`), ''];
}

export function listCarryoverLines(rows: CarryoverRow[]): InitFileRow[] {
    return rows.flatMap((row) => {
        const groups = Object.entries(CARRYOVER_GROUPS)
            .filter(([key]) => row[key as keyof typeof CARRYOVER_GROUPS].length > 0)
            .map(([key, title]) => `${title}: ${row[key as keyof typeof CARRYOVER_GROUPS].join(', ')}`);
        const note = [...(row.covered > 0 ? [`covered: ${String(row.covered)}`] : []), ...groups].join('; ');
        return [
            ...(note === '' ? [] : [{ path: row.path, note }]),
            ...row.reasons.map((line) => ({ path: row.path, note: `needs a reason: ${line}` })),
        ];
    });
}

export function formatInitPlan(plan: InitPlan, settingsText: string): string {
    const lines = [
        ...formatConfigurationSection(plan.configurations, plan.level),
        ...(plan.from === undefined
            ? []
            : formatFileSection(
                  `left out of ${plan.from.file}`,
                  plan.from.leftOutSettings.map(({ key, note }) => ({ path: key, note })),
              )),
        ...formatFileSection('write', plan.write),
        ...formatFileSection(
            `delete ${styleText('dim', DELETED_RULES_NOTE, { stream: process.stdout })}`,
            plan.deleted,
        ),
        ...formatFileSection('keep', plan.keep),
        ...formatFileSection('change', plan.change),
        ...formatFileSection(LINT_FOLDERS_HEADING, plan.lintFolders),
        ...formatFileSection(CARRYOVER_HEADING, listCarryoverLines(plan.carryover)),
        ...formatFileSection(
            LINT_COMMANDS_HEADING,
            plan.lintCommands.map(({ file, line, command, fix }) => ({
                path: `${file}:${String(line)}`,
                note: `${command}  ${fix}`,
            })),
        ),
        CI_OFF_MESSAGE,
        CHANGE_LATER_MESSAGE,
        '',
        SETTINGS_FILE,
        ...settingsText
            .trimEnd()
            .split('\n')
            .map((line) => (line === '' ? '' : `  ${line}`)),
    ];
    return `${lines.join('\n')}\n`;
}
