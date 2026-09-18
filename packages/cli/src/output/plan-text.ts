// The init, upgrade and --dry-run plans as text.
import { paint } from '#cli/output/messages.ts';
import type { TakeoverPlan } from '#types/lifecycle.ts';

const COLUMN_GAP = 2;

function section(title: string, rows: { path: string; note: string }[]): string[] {
    if (rows.length === 0) return [];
    const width = Math.max(...rows.map((row) => row.path.length)) + COLUMN_GAP;
    return [title, ...rows.map((row) => `  ${row.path.padEnd(width)}${row.note}`), ''];
}

const PRESET_WIDTH = 16;
const REASON_WIDTH = 12;

function presetSection(rows: TakeoverPlan['presets']): string[] {
    if (rows.length === 0) return ['presets', '  none: the rule files install alone', ''];
    const lines = rows.map((row) => {
        const noun = row.checks === 1 ? 'check' : 'checks';
        return `  ${row.id.padEnd(PRESET_WIDTH)} ${row.how.padEnd(REASON_WIDTH)} ${String(row.checks)} ${noun}`;
    });
    return ['presets', ...lines, ''];
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

function baselineLine(baselines: TakeoverPlan['baselines']): string {
    if (baselines.rules === 0) return '  every check passes; no baseline needed';
    const rules = `${String(baselines.rules)} rule${baselines.rules === 1 ? '' : 's'}`;
    const findings = `${String(baselines.findings)} finding${baselines.findings === 1 ? '' : 's'}`;
    return `  ${rules} enter a baseline with ${findings}; every other check passes`;
}

/**
 * The plan init prints before writing anything.
 * @param plan the plan
 * @returns the text
 */
export function initPlanText(plan: TakeoverPlan): string {
    const { dim } = paint();
    const lines = [
        ...profileSection(plan.profile),
        ...presetSection(plan.presets),
        ...section('write', plan.write),
        ...section(`delete ${dim('(git keeps them: git show HEAD:<path>)')}`, plan.remove),
        ...section('could not read; fix the file and carry its exceptions by hand', plan.unread),
        ...carriedSection(plan.carried),
        ...section('change', plan.change),
        ...section('no longer runs; delete when ready', plan.noLongerRuns),
        'baseline',
        baselineLine(plan.baselines),
    ];
    return `${lines.join('\n')}\n`;
}
