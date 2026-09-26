// The init, upgrade and --dry-run plans as text.
import { colors } from '#cli/output/messages.ts';
import type { TakeoverPlan } from '#cli/types/commands/init.ts';

const COLUMN_GAP = 2;

function section(title: string, rows: { path: string; note: string }[]): string[] {
    if (rows.length === 0) return [];
    const width = Math.max(...rows.map((row) => row.path.length)) + COLUMN_GAP;
    return [title, ...rows.map((row) => `  ${row.path.padEnd(width)}${row.note}`), ''];
}

const CONFIGURATION_WIDTH = 16;
const REASON_WIDTH = 12;

function configurationSection(rows: TakeoverPlan['configurations']): string[] {
    if (rows.length === 0) return ['configurations', '  none: the rule files install alone', ''];
    const lines = rows.map((row) => {
        const noun = row.checks === 1 ? 'check' : 'checks';
        return `  ${row.configuration.padEnd(CONFIGURATION_WIDTH)} ${row.how.padEnd(REASON_WIDTH)} ${String(row.checks)} ${noun}`;
    });
    return ['configurations', ...lines, ''];
}

function profileSection(profile: TakeoverPlan['profile']): string[] {
    if (!profile) return [];
    const detected = profile.detected.map(
        (id) => `  detected, not in the profile: ${id}  (add it afterwards: gspot add ${id})`,
    );
    return [`profile    ${profile.name}  sha256 ${profile.digest}  selection ${profile.selection}`, ...detected, ''];
}

function carriedSection(rows: TakeoverPlan['carried']): string[] {
    if (rows.length === 0) return [];
    const width = Math.max(...rows.map((row) => row.from.length)) + COLUMN_GAP;
    return [
        'carried into gspot.toml',
        ...rows.map((row) => `  ${row.from.padEnd(width)}${String(row.count)} ${row.into}`),
        '',
    ];
}

/**
 * The plan init prints before writing anything.
 * @param plan the plan
 * @returns the text
 */
export function initPlanText(plan: TakeoverPlan): string {
    const { dim } = colors;
    const lines = [
        ...profileSection(plan.profile),
        ...configurationSection(plan.configurations),
        ...section('write', plan.write),
        ...section(`delete ${dim('(git keeps them: git show HEAD:<path>)')}`, plan.remove),
        ...section('kept active', plan.retained),
        ...section('could not read; fix the file and carry its exceptions by hand', plan.unread),
        ...carriedSection(plan.carried),
        ...section('change', plan.change),
        ...section('no longer runs; delete when ready', plan.noLongerRuns),
    ];
    return `${lines.join('\n')}\n`;
}
