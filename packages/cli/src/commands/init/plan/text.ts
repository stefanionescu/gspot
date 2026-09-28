// The init, upgrade and --dry-run plans as text.
import { colors } from '#cli/output/messages.ts';
import type { ReplacePlan } from '#cli/types/commands/init.ts';
import { KIT_WIDTH, COLUMN_GAP, REASON_WIDTH } from '#cli/config/commands/init.ts';

function section(title: string, rows: { path: string; note: string }[]): string[] {
    if (rows.length === 0) return [];
    const width = Math.max(...rows.map((row) => row.path.length)) + COLUMN_GAP;
    return [title, ...rows.map((row) => `  ${row.path.padEnd(width)}${row.note}`), ''];
}

function kitSection(rows: ReplacePlan['kits']): string[] {
    if (rows.length === 0) return ['kits', '  none: the guides install alone', ''];
    const lines = rows.map((row) => {
        const noun = row.checks === 1 ? 'check' : 'checks';
        return `  ${row.kit.padEnd(KIT_WIDTH)} ${row.how.padEnd(REASON_WIDTH)} ${String(row.checks)} ${noun}`;
    });
    return ['kits', ...lines, ''];
}

function profileSection(profile: ReplacePlan['profile']): string[] {
    if (!profile) return [];
    const detected = profile.detected.map(
        (id) => `  detected, not in the profile: ${id}  (add it afterwards: gspot add ${id})`,
    );
    return [`profile    ${profile.name}  sha256 ${profile.digest}  selection ${profile.selection}`, ...detected, ''];
}

function keptSection(rows: ReplacePlan['kept']): string[] {
    if (rows.length === 0) return [];
    const width = Math.max(...rows.map((row) => row.from.length)) + COLUMN_GAP;
    return [
        'kept in gspot.toml',
        ...rows.map((row) => `  ${row.from.padEnd(width)}${String(row.count)} ${row.into}`),
        '',
    ];
}

/**
 * The plan init prints before writing anything.
 * @param plan the plan
 * @returns the text
 */
export function initPlanText(plan: ReplacePlan): string {
    const { dim } = colors;
    const lines = [
        ...profileSection(plan.profile),
        ...kitSection(plan.kits),
        ...section('write', plan.write),
        ...section(`delete ${dim('(git keeps them: git show HEAD:<path>)')}`, plan.remove),
        ...section('kept active', plan.retained),
        ...section('could not read; fix the file and keep its exceptions by hand', plan.unread),
        ...keptSection(plan.kept),
        ...section('change', plan.change),
        ...section('no longer runs; delete when ready', plan.noLongerRuns),
        ...(plan.ci === undefined
            ? []
            : [
                  'CI setup (no workflow generated)',
                  ...plan.ci.commands.map((command) => `  ${command}`),
                  `  ${plan.ci.reports}`,
                  '',
              ]),
    ];
    return `${lines.join('\n')}\n`;
}
