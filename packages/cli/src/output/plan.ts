// The init, upgrade and --dry-run plans as text.
import { paint } from '#cli/output/messages.ts';
import type { TakeoverPlan } from '#types/render.ts';

function pad(text: string, width: number): string {
    return text.length >= width ? text : text + ' '.repeat(width - text.length);
}

function section(title: string, rows: { path: string; note: string }[], lines: string[]): void {
    if (rows.length === 0) return;
    const width = Math.max(...rows.map((row) => row.path.length)) + 2;
    lines.push(title);
    for (const row of rows) lines.push(`  ${pad(row.path, width)}${row.note}`);
    lines.push('');
}

/** The plan init prints before writing anything. */
export function renderInitPlan(plan: TakeoverPlan): string {
    const { dim } = paint();
    const lines: string[] = [];
    section('write', plan.write, lines);
    section(`delete ${dim('(git keeps them: git show HEAD:<path>)')}`, plan.remove, lines);
    if (plan.carried.length > 0) {
        lines.push('carried into gspot.toml');
        const width = Math.max(...plan.carried.map((row) => row.from.length)) + 2;
        for (const row of plan.carried) lines.push(`  ${pad(row.from, width)}${row.count} ${row.into}`);
        lines.push('');
    }
    section('change', plan.change, lines);
    section('no longer runs; delete when ready', plan.noLongerRuns, lines);
    lines.push('baseline');
    lines.push(
        plan.baselines.rules === 0
            ? '  every check passes; no baseline needed'
            : `  ${plan.baselines.rules} rule${plan.baselines.rules === 1 ? '' : 's'} enter a baseline with ${plan.baselines.findings} finding${plan.baselines.findings === 1 ? '' : 's'}; every other check passes`,
    );
    return `${lines.join('\n')}\n`;
}
